# CDK Spec

## Description

CDK infrastructure for the Dakoder system. Each target project deploys its own stack.

## Architecture Decision

Each project that uses dakoder deploys its own CDK stack. The stack reads `.dakoder.toml` from the repo root at synth time and uses it to configure all resources. This means:

- One stack per project (no multi-tenant orchestration)
- Config values (repo URL, branch, credentials ARN) are baked into Lambda env vars
- The orchestrator doesn't need these values in the event payload at runtime
- CDK can grant least-privilege IAM (e.g., specific secret ARN access)

## Requirements

- All resources named with a stack tag prefix derived from `project.name` in `.dakoder.toml`
- Reads `.dakoder.toml` at synth time using `parseConfig()` from `dakoder-config`
- S3 bucket used as shared file system across all Lambdas
- Lambdas have read/write permissions to the S3 bucket
- Each Lambda function defined separately (orchestrator, code, build, review)
- Lambda environment variables set from config:
  - `BUCKET_NAME` — S3 bucket name
  - `REPO_URL` — from `git.repo_url`
  - `DEFAULT_BRANCH` — from `git.default_branch`
  - `BRANCH_PREFIX` — from `git.branch_prefix`
  - `GIT_CREDENTIALS_SECRET` — from `git.credentials_secret`
  - `MAX_ITERATIONS` — from `workflow.max_iterations`
  - Function name cross-references (e.g., `CODE_FUNCTION_NAME`)
- Lambda granted `secretsmanager:GetSecretValue` on the specific `credentials_secret` ARN

## Stack Tag

Derived from `project.name` in `.dakoder.toml` (e.g., project name `"my-app"` → stack tag `"my-app"`).
