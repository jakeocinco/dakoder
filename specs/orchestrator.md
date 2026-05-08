# Orchestrator Lambda

## Inputs

- Trigger event (format varies by source)
- Task definition:
  - Repo URL
  - Branch name
  - Description of work to be done
  - Task ID (if resuming existing task)

## Outputs

- Task status: `success` | `failed` | `max_retries_exceeded`
- PR link (on success)
- Error report (on failure)

## Requirements

- No LLM usage — pure deterministic logic
- Only creates a new S3 workspace for new tasks (keyed by task ID in folder name)
- Existing tasks reuse their workspace: `s3://dakoder-workspace/{task-id}/`
- Performs fresh git clone only on new task creation
- Constructs prompts for the Code Lambda (initial + incorporating feedback on retries)
- All Lambda invocations are async
- Worker Lambdas can invoke each other directly (not just orchestrator → worker)
- Tracks iteration count, enforces max retry limit
- On approval: pushes branch, opens PR, notifies
- On max retries exceeded: halts and reports failure

## Plan

1. Parse trigger event, extract task definition
2. Determine if new or existing task
   - **New task:** generate task ID, create S3 folder `s3://dakoder-workspace/{task-id}/`, git clone
   - **Existing task:** reuse existing workspace
3. Build prompt (initial for new, or append feedback for retry)
4. Async invoke Code Lambda with `{ taskId, prompt }`
   - Code Lambda async invokes Build Lambda on completion
   - Build Lambda async invokes Review Lambda on success (or Orchestrator on failure)
   - Review Lambda async invokes Orchestrator with result
5. On callback from Review:
   - Approved → push branch, open PR, return success
   - Rejected → increment iteration, rebuild prompt with feedback, restart at step 4
   - Max retries exceeded → halt, report failure

## Implementation Tasks

1. **Project setup** — Initialize TypeScript project, configure build, add dependencies (AWS SDK, Lambda types)
2. **Handler skeleton** — Lambda handler that parses trigger event and routes to new vs existing task logic
3. **Task ID generation** — Utility to generate unique task IDs
4. **S3 workspace creation** — Create folder in S3, clone repo into it (new tasks only)
5. **Prompt builder** — Construct initial prompt from task description; append build errors or review feedback on retries
6. **Async Lambda invocation** — Utility to async invoke other Lambdas (Code, Build, Review) with payload
7. **Callback handler** — Logic to receive async results from Review Lambda, decide approve/retry/halt
8. **Iteration tracking** — Store and increment retry count per task (S3 or DynamoDB), enforce max limit
9. **Finalization** — On approval: push branch, open PR, send notification
10. **Error handling** — Timeouts, invoke failures, malformed payloads
