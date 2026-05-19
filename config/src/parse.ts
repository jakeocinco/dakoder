import { parse } from "smol-toml";
import type { DakoderConfig, AgentConfig } from "./types.ts";
import { ConfigError, DEFAULTS, VALID_TRIGGERS } from "./types.ts";

export function parseConfig(raw: string): DakoderConfig {
  let parsed: Record<string, unknown>;
  try {
    parsed = parse(raw) as Record<string, unknown>;
  } catch (e: unknown) {
    throw new ConfigError(`Invalid TOML: ${(e as Error).message}`);
  }

  const project = parsed.project as Record<string, unknown> | undefined;
  const git = parsed.git as Record<string, unknown> | undefined;
  const workflow = parsed.workflow as Record<string, unknown> | undefined;
  const triggers = parsed.triggers as Record<string, unknown> | undefined;
  const agents = parsed.agents as Record<string, unknown> | undefined;

  requireString(project, "project", "name");
  requireString(git, "git", "repo_url");
  requireString(git, "git", "credentials_secret");

  if (!triggers || !("enabled" in triggers)) {
    throw new ConfigError("Missing required field: triggers.enabled");
  }
  if (!Array.isArray(triggers.enabled)) {
    throw new ConfigError(
      `Invalid type for triggers.enabled: expected array, got ${typeof triggers.enabled}`,
    );
  }
  if (triggers.enabled.length === 0) {
    throw new ConfigError("triggers.enabled must not be empty");
  }
  for (const t of triggers.enabled) {
    if (!(VALID_TRIGGERS as readonly string[]).includes(t)) {
      throw new ConfigError(
        `Invalid trigger type: '${t}'. Valid types: ${VALID_TRIGGERS.join(", ")}`,
      );
    }
  }

  optionalNumber(workflow, "workflow", "max_iterations");

  const codeSection = agents?.code as Record<string, unknown> | undefined;
  const reviewSection = agents?.review as Record<string, unknown> | undefined;
  optionalNumber(codeSection, "agents.code", "max_turns");
  optionalNumber(reviewSection, "agents.review", "max_turns");

  return {
    project: { name: project!.name as string },
    git: {
      repo_url: git!.repo_url as string,
      default_branch:
        (git!.default_branch as string) ?? DEFAULTS.default_branch,
      branch_prefix: (git!.branch_prefix as string) ?? DEFAULTS.branch_prefix,
      credentials_secret: git!.credentials_secret as string,
    },
    workflow: {
      max_iterations:
        (workflow?.max_iterations as number) ?? DEFAULTS.max_iterations,
    },
    triggers: { enabled: triggers.enabled as string[] },
    agents: {
      code: codeSection
        ? agentConfig(codeSection, DEFAULTS.code_max_turns)
        : undefined,
      review: reviewSection
        ? agentConfig(reviewSection, DEFAULTS.review_max_turns)
        : undefined,
    },
  };
}

function agentConfig(
  s: Record<string, unknown>,
  defaultMaxTurns: number,
): AgentConfig {
  return {
    prompt_file: s.prompt_file as string | undefined,
    max_turns: (s.max_turns as number) ?? defaultMaxTurns,
  };
}

function requireString(
  s: Record<string, unknown> | undefined,
  sectionName: string,
  field: string,
): void {
  if (!s || !(field in s)) {
    throw new ConfigError(`Missing required field: ${sectionName}.${field}`);
  }
  if (typeof s[field] !== "string") {
    throw new ConfigError(
      `Invalid type for ${sectionName}.${field}: expected string, got ${typeof s[field]}`,
    );
  }
}

function optionalNumber(
  s: Record<string, unknown> | undefined,
  sectionName: string,
  field: string,
): void {
  if (!s || !(field in s)) return;
  if (typeof s[field] !== "number") {
    throw new ConfigError(
      `Invalid type for ${sectionName}.${field}: expected number, got ${typeof s[field]}`,
    );
  }
}
