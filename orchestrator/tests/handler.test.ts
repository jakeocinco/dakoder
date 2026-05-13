import { describe, it } from "node:test";
import assert from "node:assert";
import { handler } from "../src/index.ts";

const stubContext = {} as any;
const stubCallback = () => {};

describe("handler", () => {
  it("rejects missing type", async () => {
    const res = await handler({} as any, stubContext, stubCallback);
    assert.strictEqual(res.statusCode, 400);
  });

  it("rejects unknown type", async () => {
    const res = await handler({ type: "bogus" } as any, stubContext, stubCallback);
    assert.strictEqual(res.statusCode, 400);
  });

  it("routes new-task", async () => {
    const res = await handler(
      { type: "new-task", repoUrl: "https://github.com/x/y", branch: "main", description: "do stuff" } as any,
      stubContext,
      stubCallback
    );
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body, "new-task accepted");
  });

  it("rejects incomplete new-task", async () => {
    const res = await handler({ type: "new-task", repoUrl: "" } as any, stubContext, stubCallback);
    assert.strictEqual(res.statusCode, 400);
  });

  it("routes callback", async () => {
    const res = await handler(
      { type: "callback", taskId: "abc-123", status: "approved" } as any,
      stubContext,
      stubCallback
    );
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body, "callback accepted");
  });

  it("rejects incomplete callback", async () => {
    const res = await handler({ type: "callback", taskId: "" } as any, stubContext, stubCallback);
    assert.strictEqual(res.statusCode, 400);
  });
});
