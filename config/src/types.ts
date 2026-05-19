export interface ProjectConfig {
  name: string;
}

export interface GitConfig {
  repo_url: string;
  default_branch: string;
  branch_prefix: string;
  credentials_secret: string;
}

export interface WorkflowConfig {
  max_iterations: number;
}

export interface TriggersConfig {
  enabled: string[];
}

export interface AgentConfig {
  prompt_file?: string;
  max_turns: number;
}

export interface AgentsConfig {
  code?: AgentConfig;
  review?: AgentConfig;
}

export interface DakoderConfig {
  project: ProjectConfig;
  git: GitConfig;
  workflow: WorkflowConfig;
  triggers: TriggersConfig;
  agents: AgentsConfig;
}

export const VALID_TRIGGERS = ["pr_comment", "merge"] as const;

export const DEFAULTS = {
  default_branch: "main",
  branch_prefix: "dakoder/",
  max_iterations: 5,
  code_max_turns: 25,
  review_max_turns: 10,
} as const;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}
