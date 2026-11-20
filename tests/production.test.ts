import test from "node:test";
import assert from "node:assert/strict";
import { configuredOrigin, isProductionDeployment, requestOrigin } from "../src/lib/deployment";
import { checkProduction } from "../src/lib/production-check";
import { prepareStore, getStore } from "../src/lib/data/store";

test("Vercel production cannot be downgraded to generated preview inventory", async () => {
  const previous = { ...process.env };
  try {
    process.env.VERCEL_ENV = "production";
    process.env.PROPIT_MODE = "preview";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    assert.equal(isProductionDeployment(), true);
    await assert.rejects(prepareStore());
    assert.throws(getStore);
  } finally { for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key]; Object.assign(process.env, previous); }
});

test("production redirects ignore untrusted Host headers and reject malformed canonical origins", () => {
  const previous = { ...process.env };
  try {
    process.env.PROPIT_MODE = "production";
    for (const origin of ["http://example.com", "https://localhost", "https://user:secret@example.com", "https://example.com/path", "https://example.com/?token=x"]) {
      process.env.NEXT_PUBLIC_SITE_URL = origin; assert.equal(configuredOrigin(), null);
    }
    process.env.NEXT_PUBLIC_SITE_URL = "https://propit.example";
    assert.equal(requestOrigin(new Request("https://evil.test/auth/callback", { headers: { host: "evil.test" } })), "https://propit.example");
  } finally { for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key]; Object.assign(process.env, previous); }
});

test("launch gate fails closed when required production services are absent", async () => {
  const previous = { ...process.env };
  try {
    process.env.PROPIT_MODE = "production";
    for (const key of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "RATE_LIMIT_SECRET"]) delete process.env[key];
    assert.equal((await checkProduction()).length, 4);
  } finally { for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key]; Object.assign(process.env, previous); }
});
