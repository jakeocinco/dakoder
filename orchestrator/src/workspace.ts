import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

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

  // TODO: clone repo into workspace

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
