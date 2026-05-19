import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseConfig, ConfigError, DEFAULTS } from "../src/index.ts";

const VALID_CONFIG = `
[project]
name = "my-app"

[git]
repo_url = "https://github.com/user/my-app.git"
credentials_secret = "arn:aws:secretsmanager:us-east-1:123:secret:token"

[triggers]
enabled = ["pr_comment", "merge"]

[agents.code]
prompt_file = ".dakoder/code-prompt.md"
max_turns = 20

[agents.review]
prompt_file = ".dakoder/review-prompt.md"
max_turns = 8
`;

describe("parseConfig", () => {
  it("parses valid config with all fields", () => {
    const config = parseConfig(VALID_CONFIG);
    assert.equal(config.project.name, "my-app");
    assert.equal(config.git.repo_url, "https://github.com/user/my-app.git");
    assert.equal(config.git.default_branch, DEFAULTS.default_branch);
    assert.equal(config.git.branch_prefix, DEFAULTS.branch_prefix);
    assert.equal(
      config.git.credentials_secret,
      "arn:aws:secretsmanager:us-east-1:123:secret:token",
    );
    assert.equal(config.workflow.max_iterations, DEFAULTS.max_iterations);
    assert.deepEqual(config.triggers.enabled, ["pr_comment", "merge"]);
    assert.equal(config.agents.code?.prompt_file, ".dakoder/code-prompt.md");
    assert.equal(config.agents.code?.max_turns, 20);
    assert.equal(
      config.agents.review?.prompt_file,
      ".dakoder/review-prompt.md",
    );
    assert.equal(config.agents.review?.max_turns, 8);
  });

  it("applies defaults for optional fields", () => {
    const minimal = `
[project]
name = "app"
[git]
repo_url = "https://github.com/u/r.git"
credentials_secret = "arn:aws:secretsmanager:us-east-1:123:secret:x"
[triggers]
enabled = ["merge"]
`;
    const config = parseConfig(minimal);
    assert.equal(config.git.default_branch, "main");
    assert.equal(config.git.branch_prefix, "dakoder/");
    assert.equal(config.workflow.max_iterations, 5);
    assert.equal(config.agents.code, undefined);
    assert.equal(config.agents.review, undefined);
  });

  it("throws on missing project.name", () => {
    const toml = `
[project]
[git]
repo_url = "x"
credentials_secret = "x"
[triggers]
enabled = ["merge"]
`;
    assert.throws(
      () => parseConfig(toml),
      (e: unknown) => {
        assert(e instanceof ConfigError);
        assert(e.message.includes("project.name"));
        return true;
      },
    );
  });

  it("throws on missing git.repo_url", () => {
    const toml = `
[project]
name = "x"
[git]
credentials_secret = "x"
[triggers]
enabled = ["merge"]
`;
    assert.throws(
      () => parseConfig(toml),
      (e: unknown) => {
        assert(e instanceof ConfigError);
        assert(e.message.includes("git.repo_url"));
        return true;
      },
    );
  });

  it("throws on missing git.credentials_secret", () => {
    const toml = `
[project]
name = "x"
[git]
repo_url = "x"
[triggers]
enabled = ["merge"]
`;
    assert.throws(
      () => parseConfig(toml),
      (e: unknown) => {
        assert(e instanceof ConfigError);
        assert(e.message.includes("git.credentials_secret"));
        return true;
      },
    );
  });

  it("throws on missing triggers.enabled", () => {
    const toml = `
[project]
name = "x"
[git]
repo_url = "x"
credentials_secret = "x"
[triggers]
`;
    assert.throws(
      () => parseConfig(toml),
      (e: unknown) => {
        assert(e instanceof ConfigError);
        assert(e.message.includes("triggers.enabled"));
        return true;
      },
    );
  });

  it("throws on empty triggers.enabled", () => {
    const toml = `
[project]
name = "x"
[git]
repo_url = "x"
credentials_secret = "x"
[triggers]
enabled = []
`;
    assert.throws(
      () => parseConfig(toml),
      (e: unknown) => {
        assert(e instanceof ConfigError);
        assert(e.message.includes("must not be empty"));
        return true;
      },
    );
  });

  it("throws on invalid trigger type", () => {
    const toml = `
[project]
name = "x"
[git]
repo_url = "x"
credentials_secret = "x"
[triggers]
enabled = ["push"]
`;
    assert.throws(
      () => parseConfig(toml),
      (e: unknown) => {
        assert(e instanceof ConfigError);
        assert(e.message.includes("'push'"));
        return true;
      },
    );
  });

  it("throws on invalid type for max_iterations", () => {
    const toml = `
[project]
name = "x"
[git]
repo_url = "x"
credentials_secret = "x"
[triggers]
enabled = ["merge"]
[workflow]
max_iterations = "five"
`;
    assert.throws(
      () => parseConfig(toml),
      (e: unknown) => {
        assert(e instanceof ConfigError);
        assert(e.message.includes("workflow.max_iterations"));
        assert(e.message.includes("expected number"));
        return true;
      },
    );
  });

  it("throws on invalid type for max_turns", () => {
    const toml = `
[project]
name = "x"
[git]
repo_url = "x"
credentials_secret = "x"
[triggers]
enabled = ["merge"]
[agents.code]
max_turns = "ten"
`;
    assert.throws(
      () => parseConfig(toml),
      (e: unknown) => {
        assert(e instanceof ConfigError);
        assert(e.message.includes("agents.code.max_turns"));
        assert(e.message.includes("expected number"));
        return true;
      },
    );
  });

  it("throws on invalid TOML syntax", () => {
    assert.throws(
      () => parseConfig("not [valid toml"),
      (e: unknown) => {
        assert(e instanceof ConfigError);
        assert(e.message.includes("Invalid TOML"));
        return true;
      },
    );
  });

  it("uses default max_turns when agents section omits it", () => {
    const toml = `
[project]
name = "x"
[git]
repo_url = "x"
credentials_secret = "x"
[triggers]
enabled = ["merge"]
[agents.code]
prompt_file = "p.md"
[agents.review]
prompt_file = "r.md"
`;
    const config = parseConfig(toml);
    assert.equal(config.agents.code?.max_turns, 25);
    assert.equal(config.agents.review?.max_turns, 10);
  });
});
