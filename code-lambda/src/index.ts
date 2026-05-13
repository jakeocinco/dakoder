import type { Handler } from "aws-lambda";
import { syncWorkspace, uploadChanges } from "./sync.ts";
import { runAgent } from "./agent.ts";
import { reportResult } from "./report.ts";

interface CodeLambdaEvent {
  taskId: string;
  prompt: string;
}

export const handler: Handler<CodeLambdaEvent> = async (event) => {
  if (!event?.taskId || !event?.prompt) {
    return { statusCode: 400, body: "Missing taskId or prompt" };
  }

  const { taskId, prompt } = event;
  const localPath = `/tmp/${taskId}`;

  try {
    await syncWorkspace(taskId, localPath);
    const result = await runAgent(prompt, localPath);

    if (result.success) {
      await uploadChanges(taskId, localPath);
      await reportResult(taskId, "success");
    } else {
      await reportResult(taskId, "failed", result.error);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ taskId, success: result.success }),
    };
  } catch (err: any) {
    console.error("code-lambda failed", { taskId, err });
    await reportResult(taskId, "failed", err.message).catch(() => {});
    return { statusCode: 500, body: err.message };
  }
};
