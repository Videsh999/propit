import test from "node:test";
import assert from "node:assert/strict";
import { publicSupabaseEnvironment } from "../src/lib/supabase/environment";
import { supabaseConfig, supabaseServerKey } from "../src/lib/deployment";

test("Vercel integration names produce browser configuration without exposing server credentials", () => {
  const env = { SUPABASE_URL: " https://project.supabase.co ", SUPABASE_PUBLISHABLE_KEY: " sb_publishable_fixture ", SUPABASE_SECRET_KEY: "sb_secret_fixture", SUPABASE_SERVICE_ROLE_KEY: "legacy-server-fixture", DATABASE_URL: "private-database-fixture" };
  assert.deepEqual(publicSupabaseEnvironment(env), { NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture" });
  assert.ok(!JSON.stringify(publicSupabaseEnvironment(env)).includes("secret_fixture"));
  assert.throws(() => publicSupabaseEnvironment({ SUPABASE_PUBLISHABLE_KEY: "sb_secret_wrong" }));
  assert.deepEqual(publicSupabaseEnvironment({ ...env, NEXT_PUBLIC_SUPABASE_URL: "https://override.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_override" }), { NEXT_PUBLIC_SUPABASE_URL: "https://override.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_override" });
});

test("server requests accept integration credentials and retain legacy compatibility", () => {
  const previous = { ...process.env };
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fixture";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_fixture";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy-server-fixture";
    assert.deepEqual(supabaseConfig(), { url: "https://project.supabase.co", key: "sb_publishable_fixture" });
    assert.equal(supabaseServerKey(), "sb_secret_fixture");
    delete process.env.SUPABASE_SECRET_KEY;
    assert.equal(supabaseServerKey(), "legacy-server-fixture");
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});
