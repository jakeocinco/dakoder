import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { cloneRepo, getGitToken } from "./git.ts";

const s3 = new S3Client();
const getBucket = () => process.env.BUCKET_NAME!;

export interface TaskMetadata {
  taskId: string;
  repoUrl: string;
  branch: string;
  description: string;
  createdAt: string;
}

export async function createWorkspace(
  taskId: string,
  repoUrl: string,
  branch: string,
  description: string,
): Promise<{ created: boolean; path: string }> {
  const bucket = getBucket();
  const metadataKey = `${taskId}/metadata.json`;

  if (await workspaceExists(bucket, metadataKey)) {
    return { created: false, path: `s3://${bucket}/${taskId}/` };
  }

  const metadata: TaskMetadata = {
    taskId,
    repoUrl,
    branch,
    description,
    createdAt: new Date().toISOString(),
  };

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: metadataKey,
      Body: JSON.stringify(metadata),
      ContentType: "application/json",
    }),
  );

  const localPath = `/tmp/${taskId}`;
  const token = await getGitToken(process.env.GIT_CREDENTIALS_SECRET!);
  await cloneRepo(repoUrl, branch, token, localPath);
  await uploadDir(bucket, taskId, localPath);

  return { created: true, path: `s3://${bucket}/${taskId}/` };
}

async function workspaceExists(bucket: string, key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadDir(
  bucket: string,
  taskId: string,
  dir: string,
): Promise<void> {
  for (const filePath of await getAllFiles(dir)) {
    const rel = relative(dir, filePath);
    if (rel.startsWith(".git/")) continue;
    const body = await readFile(filePath);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${taskId}/${rel}`,
        Body: body,
      }),
    );
  }
}

async function getAllFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await getAllFiles(full)));
    } else {
      results.push(full);
    }
  }
  return results;
}
