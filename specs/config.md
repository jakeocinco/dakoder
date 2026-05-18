# Config Package

## Purpose

A shared package that parses and validates `.dakoder.toml` — a per-repo configuration file that controls how dakoder operates on a repository. Parsed deterministically by code (not LLM). Fails fast with descriptive errors on invalid config.

## Config File

Each target repository contains a `.dakoder.toml` at its root. This file declares project metadata, git settings, workflow parameters, trigger types, and per-phase agent configurations.

## Config Shape

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

## Field Details

### `[project]`

| Field  | Required | Type   | Description        |
|--------|----------|--------|--------------------|
| `name` | yes      | string | Project identifier |

### `[git]`

| Field                | Required | Type   | Default      | Description                                      |
|----------------------|----------|--------|--------------|--------------------------------------------------|
| `repo_url`           | yes      | string | —            | HTTPS clone URL                                  |
| `default_branch`     | no       | string | `"main"`     | Target branch for PRs                            |
| `branch_prefix`      | no       | string | `"dakoder/"` | Prefix for working branches                      |
| `credentials_secret` | yes      | string | —            | AWS Secrets Manager ARN for git auth token       |

### `[workflow]`

| Field            | Required | Type   | Default | Description                        |
|------------------|----------|--------|---------|------------------------------------|
| `max_iterations` | no       | number | `5`     | Max retry loops before halting     |

### `[triggers]`

| Field     | Required | Type     | Description                                          |
|-----------|----------|----------|------------------------------------------------------|
| `enabled` | yes      | string[] | List of trigger types (e.g., `"pr_comment"`, `"merge"`) |

### `[agents.code]` (optional section — falls back to Claude defaults)

| Field        | Required | Type   | Default | Description                                    |
|--------------|----------|--------|---------|------------------------------------------------|
| `prompt_file`| no       | string | —       | Path to markdown file with custom system prompt |
| `max_turns`  | no       | number | `25`    | Max agent turns                                |

### `[agents.review]` (optional section — falls back to Claude defaults)

| Field        | Required | Type   | Default | Description                                    |
|--------------|----------|--------|---------|------------------------------------------------|
| `prompt_file`| no       | string | —       | Path to markdown file with custom system prompt |
| `max_turns`  | no       | number | `10`    | Max agent turns                                |

## How It Works

1. Orchestrator downloads `.dakoder.toml` from the task's S3 workspace after clone
2. Calls `parseConfig(raw)` which parses TOML and validates all fields
3. Returns a fully resolved `DakoderConfig` object with defaults applied
4. If parsing or validation fails, throws a `ConfigError` with a descriptive message
5. Orchestrator uses config values to control workflow (max_iterations, triggers)
6. Orchestrator passes agent config to code-lambda and review-lambda in their event payloads

## Parsing Library

Uses `smol-toml` — zero dependencies, TypeScript-native, TOML v1.1.0 compliant, most downloaded TOML parser on npm.

## Validation Rules

- Missing required fields → throw with field name and section
- Wrong type (e.g., `max_iterations = "five"`) → throw with expected vs actual type
- Invalid TOML syntax → throw with parse error from smol-toml
- Empty `triggers.enabled` array → throw (must have at least one trigger)
- Unknown trigger types → throw with the invalid value (valid: `"pr_comment"`, `"merge"`)

## Consumers

- **Orchestrator** — parses config, uses workflow/trigger/git settings, passes agent config downstream
- **Code Lambda** — receives agent config (`prompt_file`, `max_turns`) in event payload, applies to agent invocation
- **Review Lambda** — receives agent config in event payload (future)

## Inputs

- Raw TOML string (file contents of `.dakoder.toml`)

## Outputs

- `DakoderConfig` — fully typed, validated, defaults-applied config object
- Or throws `ConfigError` with descriptive message

## Error Handling

- All errors are `ConfigError` instances with a `message` describing what went wrong
- Errors are deterministic — same input always produces same error
- Orchestrator catches `ConfigError` and fails the task with the error message

## Implementation Tasks

### 4.1 — Project Setup
- `package.json` with `smol-toml` dependency, build and test scripts
- `tsconfig.json` for Node.js (matching existing packages)
- Folder structure: `src/`, `tests/`
- Added to root `package.json` workspaces

### 4.2 — Types and Defaults
- TypeScript interfaces for `DakoderConfig` and all sub-sections
- Constants for default values
- `ConfigError` class

### 4.3 — Parse and Validate
- `parseConfig(raw: string): DakoderConfig` function
- TOML parsing via `smol-toml`
- Field-by-field validation with descriptive errors
- Defaults applied for optional fields

### 4.4 — Unit Tests
- Valid config parses correctly
- Missing required fields throw with clear messages
- Invalid types throw
- Optional fields get defaults
- Invalid TOML syntax throws
- Empty triggers array throws
- Unknown trigger types throw

### 4.5 — Example Config and Prompt Files
- `.dakoder.toml` at repo root as working example
- `.dakoder/code-prompt.md` placeholder
- `.dakoder/review-prompt.md` placeholder

## Open Questions

- Should we support additional trigger types beyond `"pr_comment"` and `"merge"`?
- Should agent config support `allowed_tools` override or always use the hardcoded set?
