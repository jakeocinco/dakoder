import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseConfig } from "../src/index.ts";

it("parses the repo .dakoder.toml", () => {
  const raw = readFileSync(
    resolve(import.meta.dirname, "../../.dakoder.toml"),
    "utf-8",
  );
  const config = parseConfig(raw);
  assert.equal(config.project.name, "dakoder");
  assert.equal(config.git.default_branch, "main");
  assert.deepEqual(config.triggers.enabled, ["pr_comment", "merge"]);
});
