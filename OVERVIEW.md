# Dakoder - Architecture Overview

## Purpose

A serverless system of Lambda functions that leverages coding agents (Kiro, Claude Code) to automate coding, review, and build tasks.

## Tech Stack

- **Language:** TypeScript (all Lambdas)
- **Agent SDK:** Claude Code SDK
- **Runtime:** AWS Lambda (Node.js)
- **Storage:** S3

## Architecture

### Triggers

Multiple trigger sources (TBD) — e.g., GitHub webhooks, scheduled events, API Gateway, manual invocation.

### Orchestrator Lambda

- Written in a real language (no LLM) — handles deterministic logic
- Receives trigger event
- Creates a new S3 folder and performs a fresh `git pull` for the task
- Constructs prompts based on task context
- Manages the task lifecycle loop: code → build → review → repeat
- Dispatches work to the appropriate worker Lambda at each stage
- When review feedback indicates changes are needed, incorporates comments into a new prompt and restarts the code step
- Tracks iteration count to enforce max retries and avoid infinite loops
- Can escalate or halt the task if repeated attempts fail to satisfy review

### Worker Lambdas

Each worker operates on the task's existing S3 folder — they do not create new folders.

#### Code Lambda
- Invokes a coding agent (Kiro/Claude Code) with the orchestrator's prompt
- Writes/modifies code in the task's S3 workspace

#### Build Lambda
- Runs build/test commands against the task's S3 workspace
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
  ├── creates S3 folder + fresh git pull
  │
  └── loop:
        Code Lambda  →  Build Lambda  →  Review Lambda
              ▲                                  │
              └──────── (if not approved) ───────┘
```

## Storage

- **S3** — shared file system
  - Each *task* gets a unique folder (e.g., `s3://dakoder-workspace/{task-id}/`)
  - Contains the fresh git clone and all artifacts
  - All workers read/write to the same task folder

## Open Questions

- Trigger mechanisms (webhook, EventBridge, manual API call — likely multiple)
- ~~Language choice for orchestrator~~ → TypeScript (all Lambdas), using Claude Code SDK
- How to pass git credentials to Lambdas securely
- Timeout/concurrency limits for agent invocations
- Loop exit conditions (max iterations, approval threshold)
- How to handle agent failures or retries
