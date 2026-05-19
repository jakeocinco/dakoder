import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { pushBranchAndOpenPR } from "./push-pr.ts";
import { notify } from "./notify.ts";

const s3 = new S3Client();
const getBucket = () => process.env.BUCKET_NAME!;

export interface FinalizeInput {
  taskId: string;
  description: string;
}

export interface FinalizeResult {
  taskId: string;
  status: "complete";
  prUrl?: string;
}

export async function finalize(input: FinalizeInput): Promise<FinalizeResult> {
  const bucket = getBucket();
  const localPath = `/tmp/${input.taskId}`;

  await downloadWorkspace(bucket, input.taskId, localPath);
  const { prUrl } = await pushBranchAndOpenPR(
    input.taskId,
    localPath,
    input.description,
  );

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `${input.taskId}/status.json`,
      Body: JSON.stringify({
        status: "complete",
        prUrl,
        completedAt: new Date().toISOString(),
      }),
      ContentType: "application/json",
    }),
  );

  await notify({
    taskId: input.taskId,
    status: "complete",
    message: input.description,
    prUrl,
  });

  return { taskId: input.taskId, status: "complete", prUrl };
}

async function downloadWorkspace(
  bucket: string,
  taskId: string,
  localPath: string,
): Promise<void> {
  await mkdir(localPath, { recursive: true });
  let token: string | undefined;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `${taskId}/`,
        ContinuationToken: token,
      }),
    );
    for (const obj of res.Contents ?? []) {
      const rel = obj.Key!.slice(`${taskId}/`.length);
      if (
        !rel ||
        rel === "metadata.json" ||
        rel.startsWith("prompts/") ||
        rel === "status.json" ||
        rel === "iteration.json"
      )
        continue;
      const filePath = join(localPath, rel);
      await mkdir(dirname(filePath), { recursive: true });
      const getRes = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: obj.Key! }),
      );
      const body = await getRes.Body!.transformToByteArray();
      await writeFile(filePath, body);
    }
    token = res.NextContinuationToken;
  } while (token);
}
