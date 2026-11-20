import test from "node:test";
import assert from "node:assert/strict";
import { readJson, HttpError, checkSameOrigin } from "../src/lib/api/http";
import { requestBudget } from "../src/lib/api/rate-limit";

test("mutations reject cross-site requests and unexpected content types", async () => {
  assert.throws(() => checkSameOrigin(new Request("http://localhost/api/x", { headers: { "sec-fetch-site": "cross-site" } })), (e: unknown) => e instanceof HttpError && e.status === 403);
  assert.throws(() => checkSameOrigin(new Request("http://localhost/api/x", { headers: { origin: "https://evil.test" } })), HttpError);
  assert.doesNotThrow(() => checkSameOrigin(new Request("http://localhost:3004/api/x", { headers: { host: "127.0.0.1:3004", origin: "http://127.0.0.1:3004" } })));
  await assert.rejects(readJson(new Request("http://localhost/api/x", { method: "POST", body: "{}" })), (e: unknown) => e instanceof HttpError && e.status === 415);
});

test("JSON limits apply to the stream even when Content-Length lies", async () => {
  const make = (body: string, headers = {}) => new Request("http://localhost/api/x", { method: "POST", headers: { "content-type": "application/json", ...headers }, body });
  assert.deepEqual(await readJson(make('{"ok":true}')), { ok: true });
  await assert.rejects(readJson(make("not-json")), (e: unknown) => e instanceof HttpError && e.status === 400);
  await assert.rejects(readJson(make('"' + "a".repeat(100) + '"', { "content-length": "2" }), 32), (e: unknown) => e instanceof HttpError && e.status === 413);
  await assert.rejects(readJson(make("{}", { "content-length": "9999" }), 32), (e: unknown) => e instanceof HttpError && e.status === 413);
});

test("request budgets reject bursts instead of permitting unlimited paid AI", async () => {
  const request = new Request("http://localhost/api/x");
  for (let i = 0; i < 15; i++) await requestBudget(request, "ai", "test-buyer");
  await assert.rejects(requestBudget(request, "ai", "test-buyer"), (e: unknown) => e instanceof HttpError && e.status === 429);
});
