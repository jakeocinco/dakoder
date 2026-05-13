import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { mock } from "node:test";

const sendMock = mock.fn();
mock.module("@aws-sdk/client-codebuild", {
  namedExports: {
    CodeBuildClient: class {
      send = sendMock;
    },
    StartBuildCommand: class {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
  },
});

process.env.CODEBUILD_PROJECT_NAME = "test-project";
process.env.BUCKET_NAME = "test-bucket";

const { startBuild } = await import("../src/start-build.ts");

describe("startBuild", () => {
  beforeEach(() => sendMock.mock.resetCalls());

  it("starts a build and returns build ID", async () => {
    sendMock.mock.mockImplementation(async () => ({
      build: { id: "build-123" },
    }));
    const result = await startBuild("my-task");
    assert.strictEqual(result.buildId, "build-123");
  });

  it("passes taskId as env var override", async () => {
    sendMock.mock.mockImplementation(async () => ({ build: { id: "x" } }));
    await startBuild("my-task");
    const cmd = sendMock.mock.calls[0].arguments[0];
    const envVars = cmd.input.environmentVariablesOverride;
    assert.deepStrictEqual(envVars, [
      { name: "TASK_ID", value: "my-task", type: "PLAINTEXT" },
    ]);
  });
});
