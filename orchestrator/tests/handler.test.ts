import { describe, it } from "node:test";
import assert from "node:assert";
import { mock } from "node:test";

const sendMock = mock.fn(async () => ({}));

mock.module("@aws-sdk/client-s3", {
  namedExports: {
    S3Client: class {
      send = sendMock;
    },
    PutObjectCommand: class {
      constructor() {}
    },
    HeadObjectCommand: class {
      constructor() {}
    },
    GetObjectCommand: class {
      constructor() {}
    },
  },
});

mock.module("@aws-sdk/client-lambda", {
  namedExports: {
    LambdaClient: class {
      send = sendMock;
    },
    InvokeCommand: class {
      constructor() {}
    },
  },
});

process.env.BUCKET_NAME = "test-bucket";
process.env.CODE_FUNCTION_NAME = "test-code-fn";
process.env.MAX_ITERATIONS = "5";

const { handler } = await import("../src/index.ts");

const stubContext = {} as any;
const stubCallback = () => {};

describe("handler", () => {
  it("rejects missing type", async () => {
    const res = await handler({} as any, stubContext, stubCallback);
    assert.strictEqual(res.statusCode, 400);
  });

  it("rejects unknown type", async () => {
    const res = await handler(
      { type: "bogus" } as any,
      stubContext,
      stubCallback,
    );
    assert.strictEqual(res.statusCode, 400);
  });

  it("routes new-task", async () => {
    const res = await handler(
      {
        type: "new-task",
        repoUrl: "https://github.com/x/y",
        branch: "main",
        description: "do stuff",
        spec: "## Req",
      } as any,
      stubContext,
      stubCallback,
    );
    assert.strictEqual(res.statusCode, 200);
  });

  it("rejects incomplete new-task", async () => {
    const res = await handler(
      { type: "new-task", repoUrl: "" } as any,
      stubContext,
      stubCallback,
    );
    assert.strictEqual(res.statusCode, 400);
  });

  it("routes callback approved", async () => {
    const res = await handler(
      {
        type: "callback",
        taskId: "abc-123",
        status: "approved",
        description: "fix",
        spec: "## Req",
      } as any,
      stubContext,
      stubCallback,
    );
    assert.strictEqual(res.statusCode, 200);
  });

  it("rejects incomplete callback", async () => {
    const res = await handler(
      { type: "callback", taskId: "" } as any,
      stubContext,
      stubCallback,
    );
    assert.strictEqual(res.statusCode, 400);
  });
});
