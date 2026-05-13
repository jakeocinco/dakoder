import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { mock } from "node:test";

const sendMock = mock.fn(async () => ({}));
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

process.env.REVIEW_FUNCTION_NAME = "review-fn";
process.env.ORCHESTRATOR_FUNCTION_NAME = "orchestrator-fn";

const { reportResult } = await import("../src/report-result.ts");

describe("reportResult", () => {
  beforeEach(() => sendMock.mock.resetCalls());

  it("invokes review on success", async () => {
    await reportResult("my-task", "SUCCEEDED", "");
    const cmd = sendMock.mock.calls[0].arguments[0];
    assert.strictEqual(cmd.input.FunctionName, "review-fn");
  });

  it("invokes orchestrator on failure", async () => {
    await reportResult("my-task", "FAILED", "error output");
    const cmd = sendMock.mock.calls[0].arguments[0];
    assert.strictEqual(cmd.input.FunctionName, "orchestrator-fn");
    const payload = JSON.parse(Buffer.from(cmd.input.Payload).toString());
    assert.strictEqual(payload.status, "build-failed");
    assert.strictEqual(payload.buildLogs, "error output");
  });
});
