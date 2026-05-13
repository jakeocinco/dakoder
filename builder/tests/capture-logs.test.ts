import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { mock } from "node:test";

const sendMock = mock.fn();

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

const { captureLogs } = await import("../src/capture-logs.ts");

describe("captureLogs", () => {
  beforeEach(() => sendMock.mock.resetCalls());

  it("fetches logs and writes to S3", async () => {
    let callCount = 0;
    sendMock.mock.mockImplementation(async (cmd: any) => {
      if (cmd.constructor.name === "GetLogEventsCommand") {
        callCount++;
        if (callCount === 1) {
          return {
            events: [{ message: "line 1\n" }, { message: "line 2\n" }],
            nextForwardToken: "tok",
          };
        }
        return { events: [], nextForwardToken: "tok" };
      }
      return {};
    });

    const result = await captureLogs(
      "arn:aws:codebuild:us-east-1:123:build/proj:abc123",
      "my-task",
    );
    assert.ok(result.includes("line 1"));
    assert.ok(result.includes("line 2"));
  });
});
