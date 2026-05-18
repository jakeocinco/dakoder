# dakoder

Serverless coding automation powered by AI agents. Dakoder uses AWS Lambda, git triggers, and Claude to autonomously write code, run builds, review changes, and open pull requests.

## How It Works

```
Trigger (PR comment, merge)
  │
  ▼
Orchestrator Lambda
  ├── Creates S3 workspace + git clone (new tasks)
  ├── Builds prompt from task description + prior feedback
  │
  └── Async chain:
        Code Lambda  →  Build Lambda  →  Review Lambda
                                               │
                                               ▼
                                          Orchestrator
                                     (approved → PR, or retry)
```

1. A trigger (PR comment, merge) invokes the orchestrator
2. The orchestrator clones the repo into an S3 workspace and constructs a prompt
3. The code lambda runs a Claude agent against the workspace
4. CodeBuild runs the project's build and tests
5. A review agent evaluates the changes
6. If approved, dakoder pushes a branch and opens a PR. If rejected, it retries with feedback.

## Configuration

Each repo contains a `.dakoder.toml` that controls how dakoder operates:

```toml
[project]
name = "my-app"

[git]
repo_url = "https://github.com/user/my-app.git"
default_branch = "main"
branch_prefix = "dakoder/"
credentials_secret = "arn:aws:secretsmanager:us-east-1:123:secret:github-token"

[workflow]
max_iterations = 5

[triggers]
enabled = ["pr_comment", "merge"]

[agents.code]
prompt_file = ".dakoder/code-prompt.md"
max_turns = 25

[agents.review]
prompt_file = ".dakoder/review-prompt.md"
max_turns = 10
```

Agent sections are optional — omit them to use Claude's defaults. Provide a `prompt_file` to give the agent repo-specific coding conventions and context.

## Project Structure

```
dakoder/
├── orchestrator/    # Deterministic control flow, no LLM
├── code-lambda/     # Runs Claude agent to write/modify code
├── builder/         # Triggers CodeBuild, captures results
├── config/          # Shared .dakoder.toml parser and types
├── infra/           # AWS CDK stack
└── specs/           # Design docs and task breakdowns
```

## Tech Stack

- **Runtime:** TypeScript on AWS Lambda (Node.js)
- **Agent:** Claude Code SDK
- **Build:** AWS CodeBuild
- **Storage:** S3 (shared workspace per task)
- **Infra:** AWS CDK

## Development

```bash
npm install          # Install all workspace dependencies
npm run build        # Build all packages
npm test             # Run all tests
```

Individual packages:

```bash
cd orchestrator && npm test
cd code-lambda && npm test
cd config && npm test
```

## Design Principles

- **Orchestrator is deterministic** — no LLM, pure control flow
- **Strict config parsing** — `.dakoder.toml` is parsed by code, fails fast on errors
- **Async everything** — all Lambda invocations are fire-and-forget with callbacks
- **Workers chain directly** — Code → Build → Review → Orchestrator, no polling
- **No VPC** — zero baseline cost, S3 via SDK + `/tmp` as working directory

## License

MIT
