import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { mock } from "node:test";

const sendMock = mock.fn();
mock.module("@aws-sdk/client-s3", {
  namedExports: {
    S3Client: class {
      send = sendMock;
    },
    PutObjectCommand: class {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
  },
});

process.env.BUCKET_NAME = "test-workspace";
const { finalize } = await import("../src/finalize.ts");

describe("finalize", () => {
  beforeEach(() => {
    sendMock.mock.resetCalls();
    sendMock.mock.mockImplementation(async () => ({}));
  });

  it("marks task as complete in S3", async () => {
    const result = await finalize({
      taskId: "my-task",
      description: "Fix bug",
      repoUrl: "https://github.com/org/repo",
      branch: "fix-bug",
    });
    assert.deepStrictEqual(result, { taskId: "my-task", status: "complete" });
    assert.strictEqual(sendMock.mock.callCount(), 1);
    const cmd = sendMock.mock.calls[0].arguments[0];
    assert.strictEqual(cmd.input.Key, "my-task/status.json");
  });
});
