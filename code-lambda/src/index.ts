import type { Handler } from "aws-lambda";
import type { AgentConfig } from "dakoder-config";
import { syncWorkspace, uploadChanges } from "./sync.ts";
import { runAgent } from "./agent.ts";
import { reportResult } from "./report.ts";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

interface CodeLambdaEvent {
  taskId: string;
  prompt: string;
  agentConfig?: AgentConfig;
}

export const handler: Handler<CodeLambdaEvent> = async (event) => {
  if (!event?.taskId || !event?.prompt) {
    return { statusCode: 400, body: "Missing taskId or prompt" };
  }

  const { taskId, prompt, agentConfig } = event;
  const localPath = `/tmp/${taskId}`;

  try {
    await syncWorkspace(taskId, localPath);

    let fullPrompt = prompt;
    if (agentConfig?.prompt_file) {
      try {
        const content = await readFile(
          join(localPath, agentConfig.prompt_file),
          "utf-8",
        );
        fullPrompt = content + "\n\n" + prompt;
      } catch {
        console.warn(
          `Prompt file not found: ${agentConfig.prompt_file}, continuing without it`,
        );
      }
    }

    const maxTurns = agentConfig?.max_turns ?? 25;
    const result = await runAgent(fullPrompt, localPath, maxTurns);

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
