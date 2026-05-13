# Dakoder Integration Test Plan

## Target Repo

Use this repo (`dakoder`) as the test target — it has `npm install && npm test` working, making it a valid CodeBuild target.

## Prerequisites

- CDK stack deployed (`npx cdk deploy`)
- S3 bucket exists and is accessible
- All four Lambdas deployed with real handler code
- CodeBuild project created
- EventBridge rule active
- Git credentials stored in Secrets Manager/SSM (for clone/push tests)

## Test Cases

### 1. Orchestrator — New Task (Happy Path)

**Invoke:**
```json
{
  "type": "new-task",
  "repoUrl": "https://github.com/<you>/dakoder.git",
  "branch": "main",
  "description": "Add a hello-world function to orchestrator/src/hello.ts",
  "spec": "Create a file orchestrator/src/hello.ts that exports a function returning 'hello'"
}
```

**Verify:**
- S3 workspace created at `{bucket}/{taskId}/metadata.json`
- Prompt written to `{bucket}/{taskId}/prompts/0.md`
- Code Lambda invoked async (check CloudWatch logs)

### 2. Orchestrator — Malformed Event

**Invoke:**
```json
{ "type": "new-task" }
```

**Verify:**
- Returns `400` with "missing required fields"
- No S3 workspace created

### 3. Orchestrator — Callback (Approved)

**Invoke:**
```json
{
  "type": "callback",
  "taskId": "<taskId from test 1>",
  "status": "approved",
  "description": "Add hello-world function",
  "spec": "..."
}
```

**Verify:**
- Returns `{ action: "finalize" }`
- (Once 1.13 is implemented) PR opened on GitHub

### 4. Orchestrator — Callback (Build Failed, Retry)

**Invoke:**
```json
{
  "type": "callback",
  "taskId": "<taskId>",
  "status": "build-failed",
  "buildLogs": "Error: Cannot find module './hello.ts'",
  "description": "Add hello-world function",
  "spec": "..."
}
```

**Verify:**
- Iteration incremented in S3 metadata
- New prompt built with build logs appended
- Code Lambda re-invoked

### 5. Orchestrator — Callback (Max Retries)

**Setup:** Manually set iteration to max (write `iteration.json` to S3 with high count)

**Verify:**
- Returns `{ action: "halt", reason: "max iterations exceeded" }`
- No Code Lambda invocation

### 6. Builder — Start Build

**Invoke:**
```json
{ "type": "start", "taskId": "<taskId with code in S3>" }
```

**Verify:**
- CodeBuild build started (check CodeBuild console)
- `TASK_ID` env var passed to the build
- On failure to start: reports build-failed to orchestrator

### 7. Builder — Build Complete (Success via EventBridge)

**Setup:** Let a real build complete successfully.

**Verify:**
- Build Lambda receives EventBridge event
- Logs captured and written to `{bucket}/{taskId}/builds/{timestamp}.log`
- Review Lambda invoked with `{ taskId }`

### 8. Builder — Build Complete (Failure via EventBridge)

**Setup:** Push code that fails `npm test` to the workspace.

**Verify:**
- Build Lambda receives FAILED event
- Logs captured and persisted
- Orchestrator invoked with `{ type: "callback", status: "build-failed", buildLogs: "..." }`

### 9. Builder — Malformed Event

**Invoke:**
```json
{ "foo": "bar" }
```

**Verify:**
- Returns `400` with "Unknown event shape"

### 10. End-to-End Loop (Manual)

**Steps:**
1. Invoke orchestrator with a new-task event targeting this repo
2. Observe Code Lambda invocation (will fail without real agent, but validates the chain)
3. Manually simulate Code Lambda output by writing files to S3
4. Invoke builder with `{ type: "start", taskId }`
5. Wait for CodeBuild to complete
6. Observe builder → review (or builder → orchestrator on failure)
7. Manually invoke orchestrator callback with "approved"
8. Verify finalization attempted

## How to Run

```bash
# Deploy stack
cd infra && npx cdk deploy

# Invoke orchestrator (new task)
aws lambda invoke --function-name dakoder-dakoder-orchestrator \
  --invocation-type RequestResponse \
  --payload '{"type":"new-task","repoUrl":"...","branch":"main","description":"test","spec":"test spec"}' \
  /dev/stdout

# Invoke builder (start)
aws lambda invoke --function-name dakoder-dakoder-build \
  --invocation-type RequestResponse \
  --payload '{"type":"start","taskId":"<id>"}' \
  /dev/stdout

# Check S3 workspace
aws s3 ls s3://dakoder-workspace/<taskId>/
```

## Not Yet Testable

- **Code Lambda** — requires Claude Code SDK agent (no implementation yet)
- **Review Lambda** — requires Claude Code SDK agent (no implementation yet)
- **Git clone** (1.12) — not implemented
- **Git push / PR** (1.13) — not implemented
- **Notifications** (1.14) — not implemented
