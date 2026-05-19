import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { mock } from "node:test";

const sendMock = mock.fn();

mock.module("@aws-sdk/client-s3", {
  namedExports: {
    S3Client: class {
      send = sendMock;
    },
    GetObjectCommand: class {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
    PutObjectCommand: class {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
  },
});

mock.module("@aws-sdk/client-lambda", {
  namedExports: {
    LambdaClient: class {
      send = sendMock;
    },
    InvokeCommand: class {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
  },
});

process.env.BUCKET_NAME = "test-workspace";
process.env.CODE_FUNCTION_NAME = "dakoder-code";

const { handleCallback } = await import("../src/callback.ts");

const mockConfig = {
  project: { name: "test" },
  git: {
    repo_url: "https://github.com/x/y.git",
    default_branch: "main",
    branch_prefix: "dakoder/",
    credentials_secret: "arn:aws:secretsmanager:us-east-1:123:secret:x",
  },
  workflow: { max_iterations: 3 },
  triggers: { enabled: ["merge"] },
  agents: {},
};

const basePayload = {
  taskId: "my-task",
  description: "Fix the bug",
  spec: "## Requirements\n\n- Fix it",
};

describe("handleCallback", () => {
  beforeEach(() => {
    sendMock.mock.resetCalls();
  });

  it("returns finalize on approved", async () => {
    const result = await handleCallback(
      { ...basePayload, status: "approved" },
      mockConfig as any,
    );
    assert.deepStrictEqual(result, { action: "finalize", taskId: "my-task" });
  });

  it("retries on rejection when under max iterations", async () => {
    sendMock.mock.mockImplementation(async (cmd: any) => {
      if (cmd.constructor.name === "GetObjectCommand") {
        return {
          Body: {
            transformToString: async () => JSON.stringify({ iteration: 1 }),
          },
        };
      }
      return {};
    });

    const result = await handleCallback(
      { ...basePayload, status: "rejected", feedback: "needs work" },
      mockConfig as any,
    );
    assert.strictEqual(result.action, "retry");
  });

  it("halts when max iterations reached", async () => {
    sendMock.mock.mockImplementation(async (cmd: any) => {
      if (cmd.constructor.name === "GetObjectCommand") {
        return {
          Body: {
            transformToString: async () => JSON.stringify({ iteration: 3 }),
          },
        };
      }
      return {};
    });

    const result = await handleCallback(
      { ...basePayload, status: "rejected", feedback: "still bad" },
      mockConfig as any,
    );
    assert.deepStrictEqual(result, {
      action: "halt",
      taskId: "my-task",
      reason: "max iterations exceeded",
    });
  });
});
