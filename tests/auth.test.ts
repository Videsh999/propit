import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { authCallbackUrl, authPageHref, emailLinkRequest } from "../src/lib/auth/email-link";

test("email login and signup send the correct account-creation policy to the real SDK", async () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const client = createClient("https://auth-test.invalid", "sb_publishable_test", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: "pkce" },
    global: { fetch: async (input, init) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return Response.json({});
    } },
  });
  for (const mode of ["login", "signup"] as const) {
    const result = await client.auth.signInWithOtp(emailLinkRequest(mode, " buyer@example.test ", " Test Buyer ", "https://propit.example", "/property/selected-home?ref=map"));
    assert.equal(result.error, null);
  }
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.create_user, false, "Email login must not silently register a new account");
  assert.equal(calls[1].body.create_user, true);
  assert.deepEqual(calls[1].body.data, { full_name: "Test Buyer" });
  assert.deepEqual(calls[0].body.data, {});
  for (const call of calls) {
    assert.equal(call.body.email, "buyer@example.test");
    assert.equal(call.body.code_challenge_method, "s256");
    assert.ok(typeof call.body.code_challenge === "string" && call.body.code_challenge.length > 20);
    const target = new URL(new URL(call.url).searchParams.get("redirect_to")!);
    assert.equal(target.origin, "https://propit.example");
    assert.equal(target.pathname, "/auth/callback");
    assert.equal(target.searchParams.get("next"), "/property/selected-home?ref=map");
  }
});

test("auth navigation preserves the intended property and rejects external destinations", () => {
  const signup = new URL(authPageHref("signup", "/property/selected?ref=map"), "https://propit.example");
  assert.equal(signup.pathname, "/signup");
  assert.equal(signup.searchParams.get("next"), "/property/selected?ref=map");
  const callback = new URL(authCallbackUrl("http://127.0.0.1:3004", "//evil.test"));
  assert.equal(callback.origin, "http://127.0.0.1:3004");
  assert.equal(callback.searchParams.get("next"), "/profile");
  assert.throws(() => authCallbackUrl("http://public-site.test", "/profile"));
  assert.throws(() => authCallbackUrl("https://user:secret@public-site.test", "/profile"));
});

test("invalid signup details are rejected before contacting the auth provider", () => {
  for (const [email, name] of [["not-an-email", "Test Buyer"], ["buyer@example.test", " "], ["buyer@example.test", "x".repeat(81)]]) {
    assert.throws(() => emailLinkRequest("signup", email, name, "https://propit.example", "/profile"));
  }
  assert.doesNotThrow(() => emailLinkRequest("login", "buyer@example.test", "", "https://propit.example", "/profile"));
});
