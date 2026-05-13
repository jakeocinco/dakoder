import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const lambda = new LambdaClient();

export async function reportResult(
  taskId: string,
  status: "success" | "failed",
  error?: string,
): Promise<void> {
  if (status === "success") {
    await lambda.send(
      new InvokeCommand({
        FunctionName: process.env.BUILD_FUNCTION_NAME!,
        InvocationType: "Event",
        Payload: Buffer.from(JSON.stringify({ type: "start", taskId })),
      }),
    );
  } else {
    await lambda.send(
      new InvokeCommand({
        FunctionName: process.env.ORCHESTRATOR_FUNCTION_NAME!,
        InvocationType: "Event",
        Payload: Buffer.from(
          JSON.stringify({
            type: "callback",
            taskId,
            status: "build-failed",
            buildLogs: error || "Code agent failed",
          }),
        ),
      }),
    );
  }
}
