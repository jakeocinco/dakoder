import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

const s3 = new S3Client();
const getBucket = () => process.env.BUCKET_NAME!;
const MAX_ITERATIONS = parseInt(process.env.MAX_ITERATIONS || "5");

export async function getIteration(
  taskId: string,
): Promise<{ current: number; maxReached: boolean }> {
  const bucket = getBucket();
  const key = `${taskId}/iteration.json`;
  try {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const body = await res.Body!.transformToString();
    const current = JSON.parse(body).iteration as number;
    return { current, maxReached: current >= MAX_ITERATIONS };
  } catch {
    return { current: 0, maxReached: false };
  }
}

export async function incrementIteration(taskId: string): Promise<number> {
  const { current } = await getIteration(taskId);
  const next = current + 1;
  const bucket = getBucket();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `${taskId}/iteration.json`,
      Body: JSON.stringify({ iteration: next }),
      ContentType: "application/json",
    }),
  );
  return next;
}
