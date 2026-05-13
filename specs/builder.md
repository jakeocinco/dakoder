# Build Lambda

## Purpose

Runs builds and tests for a task's code in an isolated CodeBuild container. Reports success/failure (with logs) back to the orchestrator.

## How It Works

1. Receives invocation from the Code Lambda with `{ taskId }`
2. Starts a CodeBuild build using the task's S3 workspace as source
3. Returns immediately (no polling)
4. EventBridge captures the `CodeBuild Build State Change` event on completion
5. EventBridge triggers the Build Lambda again with the completion event
6. Build Lambda captures logs, persists them to S3
7. Async invokes the next step:
   - **On success** → Review Lambda with `{ taskId }`
   - **On failure** → Orchestrator with `{ type: "callback", taskId, status: "build-failed", buildLogs }`

## Event Shapes

### Start (from Code Lambda)

```json
{ "type": "start", "taskId": "my-task" }
```

### Build Complete (from EventBridge)

```json
{
  "detail-type": "CodeBuild Build State Change",
  "source": "aws.codebuild",
  "detail": {
    "build-status": "SUCCEEDED" | "FAILED" | "STOPPED",
    "build-id": "arn:aws:codebuild:...",
    "environment-variables-override": [
      { "name": "TASK_ID", "value": "my-task" }
    ]
  }
}
```

## Inputs

- Event payload (start or EventBridge completion)
- Environment variables: `BUCKET_NAME`, `STACK_TAG`, `CODEBUILD_PROJECT_NAME`, `REVIEW_FUNCTION_NAME`, `ORCHESTRATOR_FUNCTION_NAME`

## Outputs

- Async invocation of Review Lambda (success) or Orchestrator (failure)
- Build logs written to `s3://{bucket}/{taskId}/builds/{timestamp}.log`

## CodeBuild Integration

- Uses a single shared CodeBuild project (defined in CDK)
- Source is pulled from the task's S3 workspace folder
- Buildspec is either:
  - Embedded in the repo (if `buildspec.yml` exists in workspace)
  - A default buildspec that runs `npm install && npm test` (fallback)
- Build environment: standard Node.js image (configurable per project later)
- `taskId` passed as an environment variable override so EventBridge events can be correlated

## EventBridge Rule (CDK)

- Matches `source: "aws.codebuild"`, `detail-type: "CodeBuild Build State Change"`
- Filters to terminal states: `SUCCEEDED`, `FAILED`, `STOPPED`
- Filters to the specific CodeBuild project name
- Target: Build Lambda

## Error Handling

- CodeBuild start failure → report build-failed to orchestrator immediately
- Build timeout/stopped → EventBridge delivers event, report build-failed
- S3 access failure → report build-failed with error

## Storage

- Build logs persisted at `s3://{bucket}/{taskId}/builds/{timestamp}.log`
- Does not modify the workspace code — read-only access to source

## Open Questions

- Should we support multiple build environments (Node, Python, etc.) per task?
- How to handle very large build logs (truncation strategy)?
- Should the buildspec be configurable per-task or always from the repo?
