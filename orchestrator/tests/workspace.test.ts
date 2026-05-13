import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { mock } from "node:test";

// Mock S3Client before importing workspace
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
    HeadObjectCommand: class {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
  },
});

process.env.BUCKET_NAME = "test-workspace";
const { createWorkspace } = await import("../src/workspace.ts");

describe("createWorkspace", () => {
  beforeEach(() => {
    sendMock.mock.resetCalls();
  });

  it("creates workspace when it does not exist", async () => {
    sendMock.mock.mockImplementation(async (cmd: any) => {
      if (cmd.constructor.name === "HeadObjectCommand") {
        throw new Error("NotFound");
      }
      return {};
    });

    const result = await createWorkspace(
      "my-task",
      "https://github.com/org/repo",
      "main",
      "do stuff",
    );

    assert.strictEqual(result.created, true);
    assert.strictEqual(result.path, "s3://test-workspace/my-task/");
    assert.strictEqual(sendMock.mock.callCount(), 2);
  });

  it("skips creation when workspace already exists", async () => {
    sendMock.mock.mockImplementation(async () => ({}));

    const result = await createWorkspace(
      "my-task",
      "https://github.com/org/repo",
      "main",
      "do stuff",
    );

    assert.strictEqual(result.created, false);
    assert.strictEqual(result.path, "s3://test-workspace/my-task/");
    assert.strictEqual(sendMock.mock.callCount(), 1);
  });
});
