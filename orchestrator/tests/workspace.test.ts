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
    HeadObjectCommand: class {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
  },
});

mock.module("../src/git.ts", {
  namedExports: {
    getGitToken: async () => "fake-token",
    cloneRepo: async () => {},
  },
});

// Mock fs/promises readdir to return empty (no files to upload)
mock.module("node:fs/promises", {
  namedExports: {
    readFile: async () => Buffer.from(""),
    readdir: async () => [],
  },
});

process.env.BUCKET_NAME = "test-workspace";
process.env.GIT_CREDENTIALS_SECRET =
  "arn:aws:secretsmanager:us-east-1:123:secret:test";
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
