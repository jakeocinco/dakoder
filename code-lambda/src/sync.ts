import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { createWriteStream, statSync, readdirSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join, relative, dirname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const s3 = new S3Client();
const getBucket = () => process.env.BUCKET_NAME!;

export async function syncWorkspace(
  taskId: string,
  localPath: string,
): Promise<void> {
  const bucket = getBucket();
  await mkdir(localPath, { recursive: true });

  let continuationToken: string | undefined;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `${taskId}/`,
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of res.Contents ?? []) {
      const key = obj.Key!;
      const relativePath = key.slice(`${taskId}/`.length);
      if (!relativePath) continue;

      const filePath = join(localPath, relativePath);
      await mkdir(dirname(filePath), { recursive: true });

      const getRes = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      await pipeline(getRes.Body as Readable, createWriteStream(filePath));
    }

    continuationToken = res.NextContinuationToken;
  } while (continuationToken);
}

export async function uploadChanges(
  taskId: string,
  localPath: string,
): Promise<void> {
  const bucket = getBucket();
  const files = getAllFiles(localPath);

  for (const filePath of files) {
    const rel = relative(localPath, filePath);
    if (rel === "metadata.json" || rel.startsWith("prompts/")) continue;

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

function getAllFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}
