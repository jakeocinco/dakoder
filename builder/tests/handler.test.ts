import { describe, it } from "node:test";
import assert from "node:assert";
import { mock } from "node:test";

const sendMock = mock.fn(async () => ({ build: { id: "b-1" } }));

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

mock.module("@aws-sdk/client-cloudwatch-logs", {
  namedExports: {
    CloudWatchLogsClient: class {
      send = sendMock;
    },
    GetLogEventsCommand: class {
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

process.env.BUCKET_NAME = "test-bucket";
process.env.CODEBUILD_PROJECT_NAME = "test-project";
process.env.REVIEW_FUNCTION_NAME = "review-fn";
process.env.ORCHESTRATOR_FUNCTION_NAME = "orchestrator-fn";

const { handler } = await import("../src/index.ts");

const ctx = {} as any;
const cb = () => {};

describe("builder handler", () => {
  it("rejects unknown event", async () => {
    const res = await handler({} as any, ctx, cb);
    assert.strictEqual(res.statusCode, 400);
  });

  it("rejects start without taskId", async () => {
    const res = await handler({ type: "start" } as any, ctx, cb);
    assert.strictEqual(res.statusCode, 400);
  });

  it("routes start event", async () => {
    const res = await handler(
      { type: "start", taskId: "my-task" } as any,
      ctx,
      cb,
    );
    assert.strictEqual(res.statusCode, 200);
  });

  it("routes EventBridge build complete", async () => {
    sendMock.mock.mockImplementation(async (cmd: any) => {
      if (cmd.constructor.name === "GetLogEventsCommand") {
        return { events: [{ message: "ok" }], nextForwardToken: undefined };
      }
      return {};
    });
    const res = await handler(
      {
        "detail-type": "CodeBuild Build State Change",
        source: "aws.codebuild",
        detail: {
          "build-status": "SUCCEEDED",
          "build-id": "arn:aws:codebuild:us-east-1:123:build/proj:abc",
          "project-name": "proj",
          "environment-variables-override": [
            { name: "TASK_ID", value: "my-task" },
          ],
        },
      } as any,
      ctx,
      cb,
    );
    assert.strictEqual(res.statusCode, 200);
  });
});
