import { describe, it } from "node:test";
import assert from "node:assert";
import { buildPrompt } from "../src/prompt.ts";

const spec = "## Requirements\n\n- Do the thing\n\n## Plan\n\n1. Step one";

describe("buildPrompt", () => {
  it("builds initial prompt with description and spec", () => {
    const result = buildPrompt({
      description: "Add login page",
      spec,
      iteration: 0,
    });
    assert.ok(result.includes("## Task\n\nAdd login page"));
    assert.ok(result.includes("## Spec\n\n" + spec));
  });

  it("includes iteration number on retries", () => {
    const result = buildPrompt({ description: "Fix bug", spec, iteration: 2 });
    assert.ok(result.includes("## Iteration 2"));
  });

  it("appends build logs on failure", () => {
    const result = buildPrompt({
      description: "Fix bug",
      spec,
      iteration: 1,
      buildLogs: "Error: missing semicolon",
    });
    assert.ok(result.includes("## Build Failure\n\nError: missing semicolon"));
  });

  it("appends review comments on rejection", () => {
    const result = buildPrompt({
      description: "Fix bug",
      spec,
      iteration: 1,
      reviewComments: "Needs error handling",
    });
    assert.ok(result.includes("## Review Feedback\n\nNeeds error handling"));
  });
});
