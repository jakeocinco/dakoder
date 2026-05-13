import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client();
const getBucket = () => process.env.BUCKET_NAME!;

export async function trackPrompt(
  taskId: string,
  iteration: number,
  prompt: string,
): Promise<void> {
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: getBucket(),
        Key: `${taskId}/prompts/${iteration}.md`,
        Body: prompt,
        ContentType: "text/markdown",
      }),
    );
  } catch (err) {
    console.error("Failed to track prompt", { taskId, iteration, err });
  }
}
