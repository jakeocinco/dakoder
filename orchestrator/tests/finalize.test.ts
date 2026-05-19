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
    ListObjectsV2Command: class {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
    GetObjectCommand: class {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
  },
});

mock.module("../src/push-pr.ts", {
  namedExports: {
    pushBranchAndOpenPR: async () => ({
      prUrl: "https://github.com/org/repo/pull/1",
    }),
  },
});

mock.module("node:fs/promises", {
  namedExports: {
    mkdir: async () => {},
    writeFile: async () => {},
  },
});

process.env.BUCKET_NAME = "test-workspace";
const { finalize } = await import("../src/finalize.ts");

describe("finalize", () => {
  beforeEach(() => {
    sendMock.mock.resetCalls();
    sendMock.mock.mockImplementation(async (cmd: any) => {
      if (cmd.constructor.name === "ListObjectsV2Command") {
        return { Contents: [] };
      }
      return {};
    });
  });

  it("pushes branch, opens PR, and marks complete", async () => {
    const result = await finalize({
      taskId: "my-task",
      description: "Fix bug",
    });
    assert.strictEqual(result.status, "complete");
    assert.strictEqual(result.prUrl, "https://github.com/org/repo/pull/1");
  });
});
