# Code Lambda

## Purpose

Invokes a Claude agent via the Claude Agent SDK to write/modify code in a task's S3 workspace based on the orchestrator's prompt.

## SDK

Package: `@anthropic-ai/claude-agent-sdk`

The SDK bundles a native Claude Code binary and spawns it as a subprocess. It provides built-in tools (Read, Write, Edit, Bash, Glob, Grep) — no need to implement tool execution ourselves.

## How It Works

1. Receives invocation from orchestrator with `{ taskId, prompt }`
2. Downloads the task's S3 workspace to a local `/tmp` directory
3. Runs the Claude Agent SDK `query()` against that local directory
4. On completion, uploads modified/new files back to S3
5. Async invokes the Build Lambda with `{ type: "start", taskId }`

## Event Shape

```json
{ "taskId": "my-task", "prompt": "..." }
```

## SDK Integration

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: taskPrompt,
  options: {
    cwd: localWorkspacePath,
    allowedTools: ["Read", "Write", "Edit", "Glob", "Grep"],
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    maxTurns: 25,
    settingSources: [],
  },
})) {
  // Stream messages, extract result
}
```

Key options:
- `cwd` — points at the downloaded workspace in `/tmp`
- `permissionMode: "bypassPermissions"` — no interactive prompts (headless)
- `allowDangerouslySkipPermissions: true` — required for bypass mode
- `maxTurns: 25` — prevent runaway loops
- `settingSources: []` — ignore filesystem settings, fully programmatic
- `allowedTools` — file/code tools only, no Bash (CodeBuild handles builds)

## Constraints

### Lambda Timeout
- Lambda max is 15 minutes
- Agent sessions can run long; `maxTurns` is the primary guard
- If the agent exceeds time, Lambda kills it — the build never starts, orchestrator retries on next callback

### Filesystem
- `/tmp` has 10GB (configurable via ephemeral storage)
- Workspace is downloaded from S3, agent works locally, results uploaded back
- `/tmp` is ephemeral — no state between invocations

### Binary Compatibility
- The SDK bundles a native binary for the platform
- Lambda runs Amazon Linux 2023 (x86_64 or arm64)
- Must ensure the correct platform binary is included in the deployment package
- Use `@anthropic-ai/claude-agent-sdk-linux-x64` (or arm64) optional dep

### Authentication
- `ANTHROPIC_API_KEY` set as environment variable on the Lambda
- Stored in Secrets Manager, referenced by CDK

## Inputs

- Event payload: `{ taskId, prompt }`
- Environment variables: `BUCKET_NAME`, `STACK_TAG`, `BUILD_FUNCTION_NAME`, `ANTHROPIC_API_KEY`

## Outputs

- Modified files uploaded to `s3://{bucket}/{taskId}/`
- Async invocation of Build Lambda with `{ type: "start", taskId }`
- On failure: async invokes Orchestrator with `{ type: "callback", taskId, status: "build-failed", buildLogs: "<agent error>" }`

## Error Handling

- Agent timeout (maxTurns exceeded) → result message with `error_max_turns`, report to orchestrator
- SDK spawn failure (binary not found) → log and report build-failed
- S3 download/upload failure → report build-failed
- API auth failure → log and report build-failed

## Implementation Tasks

### 3.1 — Project Setup
- `package.json` with `@anthropic-ai/claude-agent-sdk`, `@aws-sdk/client-s3`, `@aws-sdk/client-lambda`
- `tsconfig.json` for Node.js Lambda
- Folder structure: `src/`, `tests/`

### 3.2 — Handler Skeleton
- Lambda handler that validates `{ taskId, prompt }`
- Routes to main logic

### 3.3 — S3 Workspace Sync
- Download all files from `s3://{bucket}/{taskId}/` to `/tmp/{taskId}/`
- After agent completes, upload changed files back to S3
- Detect changes via file modification times or hash comparison

### 3.4 — Agent Invocation
- Call `query()` with the prompt and options
- Collect the `SDKResultMessage` for success/failure status
- Handle `error_max_turns` and `error_during_execution` subtypes

### 3.5 — Report and Chain
- On success: async invoke Build Lambda
- On failure: async invoke Orchestrator with build-failed callback
- Use shared async invoke utility

## Open Questions

- Do we need a cost budget per invocation (`maxBudgetUsd`)?
- Is 15-min Lambda timeout sufficient, or should this run in ECS/Fargate?
