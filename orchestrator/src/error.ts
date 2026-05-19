import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { notify } from "./notify.ts";

const s3 = new S3Client();
const getBucket = () => process.env.BUCKET_NAME!;

export async function markFailed(
  taskId: string,
  reason: string,
): Promise<void> {
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: getBucket(),
        Key: `${taskId}/status.json`,
        Body: JSON.stringify({
          status: "failed",
          reason,
          failedAt: new Date().toISOString(),
        }),
        ContentType: "application/json",
      }),
    );
    await notify({ taskId, status: "failed", message: reason });
  } catch (err) {
    console.error("Failed to write failure status", { taskId, err });
  }
}
