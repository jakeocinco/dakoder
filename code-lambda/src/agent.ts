import { query } from "@anthropic-ai/claude-agent-sdk";

export interface AgentResult {
  success: boolean;
  error?: string;
}

export async function runAgent(
  prompt: string,
  cwd: string,
  maxTurns: number = 25,
): Promise<AgentResult> {
  let result: AgentResult = { success: false, error: "No result received" };

  for await (const message of query({
    prompt,
    options: {
      cwd,
      allowedTools: ["Read", "Write", "Edit", "Glob", "Grep"],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxTurns,
      settingSources: [],
    },
  })) {
    if (message.type === "result") {
      if (message.subtype === "success") {
        result = { success: true };
      } else {
        result = {
          success: false,
          error: `${message.subtype}: ${("errors" in message && message.errors?.join(", ")) || "unknown"}`,
        };
      }
    }
  }

  return result;
}
