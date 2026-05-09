# Dakoder - Architecture Overview

## Purpose

A serverless system of Lambda functions that leverages coding agents (Kiro, Claude Code) to automate coding, review, and build tasks.

## Tech Stack

- **Language:** TypeScript (all Lambdas)
- **Agent SDK:** Claude Code SDK
- **Runtime:** AWS Lambda (Node.js)
- **Build:** AWS CodeBuild (runs builds/tests in isolated containers)
- **Storage:** S3

## Architecture

### Triggers

Multiple trigger sources (TBD) — e.g., GitHub webhooks, scheduled events, API Gateway, manual invocation.

### Orchestrator Lambda

- No LLM — pure deterministic logic
- Receives trigger event
- Only creates a new S3 workspace for new tasks (keyed by task ID in folder name); existing tasks reuse their workspace
- Performs fresh git clone only on new task creation
- Constructs prompts based on task context (initial or incorporating prior feedback)
- All Lambda invocations are async
- Workers can invoke each other directly in a chain (Code → Build → Review → Orchestrator)
- When review feedback indicates changes are needed, incorporates comments into a new prompt and restarts the code step
- Tracks iteration count to enforce max retries and avoid infinite loops
- Can escalate or halt the task if repeated attempts fail to satisfy review

### Worker Lambdas

Each worker operates on the task's existing S3 folder — they do not create new folders. All invocations are async, and workers can invoke each other directly.

#### Code Lambda
- Invokes a coding agent (Kiro/Claude Code) with the orchestrator's prompt
- Writes/modifies code in the task's S3 workspace

#### Build Lambda
- Triggers an AWS CodeBuild project with the task's S3 workspace as source
- CodeBuild runs build/test commands in a container with the appropriate toolchain
- Captures full build output (compiler errors, test failures) for feedback to the coding agent
- Reports success/failure back to orchestrator

#### Review Lambda
- Invokes a coding agent to review the changes
- Produces review comments / approval status

### Task Lifecycle

A task loops through workers until complete:

```
Trigger
  │
  ▼
Orchestrator
  ├── new task: creates S3 folder + fresh git clone
  ├── existing task: reuses workspace
  │
  └── async chain:
        Code Lambda  →  Build Lambda  →  Review Lambda
                                               │
                                               ▼
                                          Orchestrator
                                     (approved or retry)
```

## Storage

- **S3** — shared file system
  - Each *task* gets a unique folder (e.g., `s3://dakoder-workspace/{task-id}/`)
  - Only created once per new task; reused on retries
  - Contains the fresh git clone and all artifacts
  - All workers read/write to the same task folder

## Open Questions

- Trigger mechanisms (webhook, EventBridge, manual API call — likely multiple)
- ~~Language choice for orchestrator~~ → TypeScript (all Lambdas), using Claude Code SDK
- How to pass git credentials to Lambdas securely
- Timeout/concurrency limits for agent invocations
- Loop exit conditions (max iterations, approval threshold)
- How to handle agent failures or retries
