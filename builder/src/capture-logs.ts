import {
  CloudWatchLogsClient,
  GetLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const logs = new CloudWatchLogsClient();
const s3 = new S3Client();
const getBucket = () => process.env.BUCKET_NAME!;
const MAX_LOG_SIZE = 50 * 1024;

export async function captureLogs(
  buildId: string,
  taskId: string,
): Promise<string> {
  const logGroup = "/aws/codebuild/" + process.env.CODEBUILD_PROJECT_NAME!;
  const logStream = buildId.split(":").pop()!;

  let output = "";
  let nextToken: string | undefined;

  do {
    const res = await logs.send(
      new GetLogEventsCommand({
        logGroupName: logGroup,
        logStreamName: logStream,
        startFromHead: true,
        nextToken,
      }),
    );
    for (const event of res.events || []) {
      output += event.message || "";
    }
    nextToken =
      res.nextForwardToken === nextToken ? undefined : res.nextForwardToken;
  } while (nextToken && output.length < MAX_LOG_SIZE);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await s3.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: `${taskId}/builds/${timestamp}.log`,
      Body: output,
      ContentType: "text/plain",
    }),
  );

  return output.length > MAX_LOG_SIZE ? output.slice(0, MAX_LOG_SIZE) : output;
}
