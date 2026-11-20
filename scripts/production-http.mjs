import assert from "node:assert/strict";
const base = process.env.SMOKE_BASE ?? "http://127.0.0.1:3004";
const request = (path, init) => fetch(base + path, { ...init, signal: AbortSignal.timeout(20_000) });
const home = await request("/");
assert.equal(home.status, 200);
assert.equal(home.headers.get("x-content-type-options"), "nosniff");
assert.equal(home.headers.get("x-frame-options"), "DENY");
assert.equal(home.headers.has("x-powered-by"), false);
const csp = home.headers.get("content-security-policy");
assert.ok(csp?.includes("'strict-dynamic'") && csp.includes("frame-ancestors 'none'"));
const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
assert.ok(nonce);
const html = await home.text();
const scripts = [...html.matchAll(/<script\b([^>]*)>/g)];
assert.ok(scripts.length > 0);
for (const [, attributes] of scripts) assert.ok(attributes.includes(`nonce="${nonce}"`), "Every script needs the response CSP nonce");
const nextHome = await request("/");
assert.notEqual(nextHome.headers.get("content-security-policy"), csp, "Nonce must be unique per response");
assert.ok(nextHome.headers.get("cache-control")?.includes("no-store"));
assert.equal((await request("/api/health")).status, 200);

const json = { "content-type": "application/json" };
const loginHtml = await (await request("/login?next=%2Fproperty%2Fselected-home")).text();
const signupHtml = await (await request("/signup?next=%2Fproperty%2Fselected-home")).text();
assert.ok(/<input[^>]*id="auth-email"/.test(loginHtml));
assert.ok(!/<input[^>]*id="auth-name"/.test(loginHtml));
assert.ok(/<input[^>]*id="auth-name"/.test(signupHtml));
assert.ok(loginHtml.includes('/signup?next=%2Fproperty%2Fselected-home'));
assert.ok(signupHtml.includes('/login?next=%2Fproperty%2Fselected-home'));
assert.ok(loginHtml.includes('noindex') && signupHtml.includes('noindex'));
assert.equal((await request("/api/search/natural", { method: "POST", headers: { ...json, origin: base, "sec-fetch-site": "same-origin" }, body: JSON.stringify({ query: "3 BHK in Kokapet" }) })).status, 200, "Same-origin forms work on the actual local host");
for (const path of ["/api/meetings", "/api/listings", "/api/ai/chat", "/api/search/natural", "/api/properties/zone", "/api/account/state"]) {
  const response = await request(path, { method: path.endsWith("state") ? "PUT" : "POST", headers: { ...json, origin: "https://evil.test", "sec-fetch-site": "cross-site" }, body: "{}" });
  assert.equal(response.status, 403, path);
}
assert.equal((await request("/auth/signout", { method: "POST", headers: { origin: "https://evil.test", "sec-fetch-site": "cross-site" }, redirect: "manual" })).status, 403);
assert.equal((await request("/api/ai/chat", { method: "POST", headers: json, body: JSON.stringify({ padding: "x".repeat(70_000) }) })).status, 413);
assert.equal((await request("/api/meetings", { method: "POST", headers: json, body: "broken" })).status, 400);
assert.equal((await request("/api/properties?minPrice=NaN")).status, 400);
assert.equal((await request("/api/properties?minArea=200&maxArea=100")).status, 400);
const account = await request("/api/account/state");
assert.ok([401, 503].includes(account.status));
assert.ok(account.headers.get("cache-control")?.includes("no-store"));
for (const path of ["/auth/callback?next=//evil.test", "/auth/confirm?next=//evil.test"]) {
  const response = await request(path, { redirect: "manual" });
  assert.ok([302, 303, 307].includes(response.status));
  assert.equal(new URL(response.headers.get("location")).origin, new URL(base).origin);
  assert.equal(new URL(response.headers.get("location")).pathname, "/login");
}

// This measures local server processing, not public mobile-network latency.
const times = [], statuses = [];
let sequence = 0;
await Promise.all(Array.from({ length: 10 }, async () => {
  while (sequence < 100) {
    const index = sequence++;
    const started = performance.now();
    const response = await request(`/api/properties?type=${index % 2 ? "rent" : "buy"}&limit=12&clusters=0&locality=${index % 2 ? "kokapet" : "gachibowli"}`);
    const data = await response.json();
    assert.ok(Array.isArray(data.items));
    statuses.push(response.status); times.push(performance.now() - started);
  }
}));
assert.ok(statuses.every(status => status === 200), "No failed searches under concurrency");
times.sort((a, b) => a - b);
const result = { requests: times.length, concurrency: 10, errors: 0, p50ms: Math.round(times[49]), p95ms: Math.round(times[94]), maxMs: Math.round(times.at(-1)) };
console.log("Security and HTTP acceptance checks passed.");
console.log("Local search load:", JSON.stringify(result));

// Free deterministic answers are enough to verify burst protection; no model key is needed.
let limited = false;
for (let i = 0; i < 16; i++) {
  const response = await request("/api/ai/chat", { method: "POST", headers: json, body: JSON.stringify({ messages: [{ role: "user", content: "How do I check RERA?" }] }) });
  await response.text();
  if (response.status === 429) { assert.ok(response.headers.get("retry-after")); limited = true; break; }
  assert.equal(response.status, 200);
}
assert.equal(limited, true, "AI endpoint rejects a burst with Retry-After");
console.log("AI burst protection passed.");
