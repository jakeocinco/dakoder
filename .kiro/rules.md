# Dakoder Project Rules

## Code Standards

- All code is TypeScript targeting Node.js 24
- Use the Claude Code SDK for agent invocations
- Match existing code style and conventions
- Read relevant spec files before implementing a task

## Architecture

- Infrastructure is AWS CDK in the `infra/` directory
- Lambda function code lives in separate directories per function
- S3 is the shared file system — each task gets a unique folder keyed by task name
- All Lambda invocations are async (fire-and-forget with callbacks)
- Workers can invoke each other directly, not just orchestrator → worker
- The orchestrator contains no LLM logic — pure deterministic control flow

## Specs

- Specs live in `specs/` with task files numbered by function (0.x = CDK, 1.x = orchestrator)

## Git Workflow

- When a task is done, commit with the task number at the end of the header like: `message (X.Y)`
