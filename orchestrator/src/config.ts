import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { parseConfig, ConfigError } from "dakoder-config";
import type { DakoderConfig } from "dakoder-config";

const s3 = new S3Client();
const getBucket = () => process.env.BUCKET_NAME!;

export async function loadConfig(taskId: string): Promise<DakoderConfig> {
  const bucket = getBucket();
  const key = `${taskId}/.dakoder.toml`;
  let raw: string;
  try {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    raw = await res.Body!.transformToString();
  } catch {
    throw new ConfigError(`Config file not found: s3://${bucket}/${key}`);
  }
  return parseConfig(raw);
}
