import type { Handler } from "aws-lambda";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { ConfigError } from "dakoder-config";
import { generateTaskId } from "./task-id.ts";
import { createWorkspace } from "./workspace.ts";
import { buildPrompt } from "./prompt.ts";
import { handleCallback as processCallback } from "./callback.ts";
import { finalize } from "./finalize.ts";
import { trackPrompt } from "./track-prompt.ts";
import { markFailed } from "./error.ts";
import { loadConfig } from "./config.ts";

const lambda = new LambdaClient();
const getCodeFunctionName = () => process.env.CODE_FUNCTION_NAME!;

interface NewTaskEvent {
  type: "new-task";
  repoUrl: string;
  branch: string;
  description: string;
  spec: string;
}

interface CallbackEvent {
  type: "callback";
  taskId: string;
  status: "approved" | "rejected" | "build-failed";
  feedback?: string;
  buildLogs?: string;
  description: string;
  spec: string;
}

type OrchestratorEvent = NewTaskEvent | CallbackEvent;

export const handler: Handler<OrchestratorEvent> = async (event) => {
  if (!event || !event.type) {
    return { statusCode: 400, body: "Malformed event: missing type" };
  }

  switch (event.type) {
    case "new-task":
      return handleNewTask(event);
    case "callback":
      return handleCallback(event);
    default:
      return {
        statusCode: 400,
        body: `Unknown event type: ${(event as any).type}`,
      };
  }
};

async function handleNewTask(event: NewTaskEvent) {
  if (!event.repoUrl || !event.branch || !event.description || !event.spec) {
    return {
      statusCode: 400,
      body: "Malformed new-task event: missing required fields",
    };
  }

  const taskId = generateTaskId(event.description);
  try {
    await createWorkspace(
      taskId,
      event.repoUrl,
      event.branch,
      event.description,
    );

    const config = await loadConfig(taskId);

    const prompt = buildPrompt({
      description: event.description,
      spec: event.spec,
      iteration: 0,
    });
    await trackPrompt(taskId, 0, prompt);

    await lambda.send(
      new InvokeCommand({
        FunctionName: getCodeFunctionName(),
        InvocationType: "Event",
        Payload: Buffer.from(
          JSON.stringify({ taskId, prompt, agentConfig: config.agents.code }),
        ),
      }),
    );

    return { statusCode: 200, body: JSON.stringify({ taskId }) };
  } catch (err: any) {
    console.error("handleNewTask failed", { taskId, err });
    await markFailed(taskId, err.message);
    if (err instanceof ConfigError) {
      return { statusCode: 400, body: `Config error: ${err.message}` };
    }
    return { statusCode: 500, body: `Internal error: ${err.message}` };
  }
}

async function handleCallback(event: CallbackEvent) {
  if (!event.taskId || !event.status || !event.description || !event.spec) {
    return {
      statusCode: 400,
      body: "Malformed callback event: missing required fields",
    };
  }
  try {
    const config = await loadConfig(event.taskId);
    const result = await processCallback(event, config);

    if (result.action === "finalize") {
      await finalize({
        taskId: result.taskId,
        description: event.description,
      });
    }

    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err: any) {
    if (err instanceof ConfigError) {
      return { statusCode: 400, body: `Config error: ${err.message}` };
    }
    console.error("handleCallback failed", { taskId: event.taskId, err });
    await markFailed(event.taskId, err.message);
    return { statusCode: 500, body: `Internal error: ${err.message}` };
  }
}
