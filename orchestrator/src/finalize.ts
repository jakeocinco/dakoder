import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client();
const getBucket = () => process.env.BUCKET_NAME!;

export interface FinalizeInput {
  taskId: string;
  description: string;
  repoUrl: string;
  branch: string;
}

export interface FinalizeResult {
  taskId: string;
  status: "complete";
  // TODO: prUrl once git push + PR creation is implemented
}

export async function finalize(input: FinalizeInput): Promise<FinalizeResult> {
  const bucket = getBucket();

  // TODO: git push branch to remote
  // TODO: open PR via GitHub API (title from description)
  // TODO: send notification (SNS/Slack/webhook)

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `${input.taskId}/status.json`,
      Body: JSON.stringify({
        status: "complete",
        completedAt: new Date().toISOString(),
      }),
      ContentType: "application/json",
    }),
  );

  return { taskId: input.taskId, status: "complete" };
}
