import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const lambda = new LambdaClient();
const getReviewFn = () => process.env.REVIEW_FUNCTION_NAME!;
const getOrchestratorFn = () => process.env.ORCHESTRATOR_FUNCTION_NAME!;

export async function reportResult(
  taskId: string,
  status: "SUCCEEDED" | "FAILED" | "STOPPED",
  buildLogs: string,
): Promise<void> {
  if (status === "SUCCEEDED") {
    await lambda.send(
      new InvokeCommand({
        FunctionName: getReviewFn(),
        InvocationType: "Event",
        Payload: Buffer.from(JSON.stringify({ taskId })),
      }),
    );
  } else {
    await lambda.send(
      new InvokeCommand({
        FunctionName: getOrchestratorFn(),
        InvocationType: "Event",
        Payload: Buffer.from(
          JSON.stringify({
            type: "callback",
            taskId,
            status: "build-failed",
            buildLogs,
          }),
        ),
      }),
    );
  }
}
