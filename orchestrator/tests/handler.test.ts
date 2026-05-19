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
    ListObjectsV2Command: class {
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

mock.module("../src/config.ts", {
  namedExports: {
    loadConfig: async () => ({
      project: { name: "test" },
      git: {
        repo_url: "https://github.com/x/y.git",
        default_branch: "main",
        branch_prefix: "dakoder/",
        credentials_secret: "arn:aws:secretsmanager:us-east-1:123:secret:x",
      },
      workflow: { max_iterations: 5 },
      triggers: { enabled: ["merge"] },
      agents: {},
    }),
  },
});

mock.module("../src/push-pr.ts", {
  namedExports: {
    pushBranchAndOpenPR: async () => ({
      prUrl: "https://github.com/x/y/pull/1",
    }),
  },
});

mock.module("../src/git.ts", {
  namedExports: {
    getGitToken: async () => "fake-token",
    cloneRepo: async () => {},
  },
});

mock.module("node:fs/promises", {
  namedExports: {
    mkdir: async () => {},
    writeFile: async () => {},
    readFile: async () => Buffer.from(""),
    readdir: async () => [],
  },
});

process.env.BUCKET_NAME = "test-bucket";
process.env.CODE_FUNCTION_NAME = "test-code-fn";

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
