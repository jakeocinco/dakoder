import type { Handler } from "aws-lambda";
import { startBuild } from "./start-build.ts";
import { captureLogs } from "./capture-logs.ts";
import { reportResult } from "./report-result.ts";

interface StartEvent {
  type: "start";
  taskId: string;
}

interface BuildCompleteEvent {
  "detail-type": "CodeBuild Build State Change";
  source: "aws.codebuild";
  detail: {
    "build-status": "SUCCEEDED" | "FAILED" | "STOPPED";
    "build-id": string;
    "project-name": string;
    "environment-variables-override"?: { name: string; value: string }[];
  };
}

type BuildEvent = StartEvent | BuildCompleteEvent;

export const handler: Handler<BuildEvent> = async (event) => {
  if ("type" in event && event.type === "start") {
    if (!event.taskId) {
      return { statusCode: 400, body: "Missing taskId" };
    }
    return handleStart(event);
  }

  if (
    "detail-type" in event &&
    event["detail-type"] === "CodeBuild Build State Change"
  ) {
    return handleBuildComplete(event as BuildCompleteEvent);
  }

  return { statusCode: 400, body: "Unknown event shape" };
};

async function handleStart(event: StartEvent) {
  try {
    const { buildId } = await startBuild(event.taskId);
    return { statusCode: 200, body: JSON.stringify({ buildId }) };
  } catch (err: any) {
    console.error("startBuild failed", { taskId: event.taskId, err });
    await reportResult(event.taskId, "FAILED", err.message);
    return { statusCode: 500, body: `Failed to start build: ${err.message}` };
  }
}

async function handleBuildComplete(event: BuildCompleteEvent) {
  const taskId = event.detail["environment-variables-override"]?.find(
    (v) => v.name === "TASK_ID",
  )?.value;
  if (!taskId) {
    return {
      statusCode: 400,
      body: "Cannot determine taskId from build event",
    };
  }

  try {
    const buildLogs = await captureLogs(event.detail["build-id"], taskId);
    await reportResult(taskId, event.detail["build-status"], buildLogs);
    return { statusCode: 200, body: "reported" };
  } catch (err: any) {
    console.error("handleBuildComplete failed", { taskId, err });
    await reportResult(taskId, "FAILED", err.message);
    return { statusCode: 500, body: err.message };
  }
}
