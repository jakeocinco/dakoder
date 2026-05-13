import { describe, it } from "node:test";
import assert from "node:assert";
import { generateTaskId } from "../src/task-id.ts";

describe("generateTaskId", () => {
  it("lowercases and replaces non-alphanumeric with dashes", () => {
    assert.strictEqual(
      generateTaskId("Fix the Login Bug!"),
      "fix-the-login-bug",
    );
  });

  it("is deterministic", () => {
    assert.strictEqual(
      generateTaskId("same name"),
      generateTaskId("same name"),
    );
  });

  it("collapses consecutive special characters into one dash", () => {
    assert.strictEqual(generateTaskId("hello---world"), "hello-world");
  });

  it("strips leading and trailing dashes", () => {
    assert.strictEqual(generateTaskId("--hello--"), "hello");
  });

  it("produces expected format for a real task name", () => {
    assert.strictEqual(
      generateTaskId("Implement the login task"),
      "implement-the-login-task",
    );
  });
});
