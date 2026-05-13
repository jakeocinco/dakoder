import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { getIteration, incrementIteration } from "./iteration.ts";
import { buildPrompt } from "./prompt.ts";

const lambda = new LambdaClient();
const getCodeFunctionName = () => process.env.CODE_FUNCTION_NAME!;

export interface CallbackPayload {
  taskId: string;
  status: "approved" | "rejected" | "build-failed";
  feedback?: string;
  buildLogs?: string;
  spec: string;
  description: string;
}

export type CallbackResult =
  | { action: "finalize"; taskId: string }
  | { action: "retry"; taskId: string; iteration: number }
  | { action: "halt"; taskId: string; reason: string };

export async function handleCallback(
  payload: CallbackPayload,
): Promise<CallbackResult> {
  const { taskId, status } = payload;

  if (status === "approved") {
    return { action: "finalize", taskId };
  }

  const { maxReached } = await getIteration(taskId);
  if (maxReached) {
    return { action: "halt", taskId, reason: "max iterations exceeded" };
  }

  const iteration = await incrementIteration(taskId);

  const prompt = buildPrompt({
    description: payload.description,
    spec: payload.spec,
    iteration,
    buildLogs: status === "build-failed" ? payload.buildLogs : undefined,
    reviewComments: status === "rejected" ? payload.feedback : undefined,
  });

  await lambda.send(
    new InvokeCommand({
      FunctionName: getCodeFunctionName(),
      InvocationType: "Event",
      Payload: Buffer.from(JSON.stringify({ taskId, prompt })),
    }),
  );

  return { action: "retry", taskId, iteration };
}
