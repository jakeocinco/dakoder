import type { Handler } from "aws-lambda";

interface NewTaskEvent {
  type: "new-task";
  repoUrl: string;
  branch: string;
  description: string;
}

interface CallbackEvent {
  type: "callback";
  taskId: string;
  status: "approved" | "rejected" | "build-failed";
  feedback?: string;
  buildLogs?: string;
  changedFiles?: string[];
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
      return { statusCode: 400, body: `Unknown event type: ${(event as any).type}` };
  }
};

async function handleNewTask(event: NewTaskEvent) {
  if (!event.repoUrl || !event.branch || !event.description) {
    return { statusCode: 400, body: "Malformed new-task event: missing required fields" };
  }
  // TODO: generate task ID, create S3 workspace, build prompt, invoke Code Lambda
  return { statusCode: 200, body: "new-task accepted" };
}

async function handleCallback(event: CallbackEvent) {
  if (!event.taskId || !event.status) {
    return { statusCode: 400, body: "Malformed callback event: missing required fields" };
  }
  // TODO: route to finalization, retry, or halt
  return { statusCode: 200, body: "callback accepted" };
}
