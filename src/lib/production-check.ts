import { createClient } from "@supabase/supabase-js";
import { configuredOrigin, supabaseConfig } from "./deployment";
import { catalogSchema } from "./data/catalog-schema";

/** Also used by the Vercel build gate. Never return environment values or customer data. */
export async function checkProduction(): Promise<string[]> {
  const failures: string[] = [];
  if (!configuredOrigin()) failures.push("NEXT_PUBLIC_SITE_URL must be the canonical HTTPS production origin.");
  const config = supabaseConfig();
  if (!config || !config.url.startsWith("https://")) failures.push("Valid Supabase public URL and publishable key are required.");
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) failures.push("SUPABASE_SERVICE_ROLE_KEY is required on the server.");
  if ((process.env.RATE_LIMIT_SECRET?.trim().length ?? 0) < 32) failures.push("RATE_LIMIT_SECRET must contain at least 32 characters.");
  if (failures.length || !config || !secret) return failures;
  const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(10_000) }) } };
  const publicDb = createClient(config.url, config.key, options);
  const admin = createClient(config.url, secret, options);
  const checks = await Promise.allSettled([
    (async () => {
      const { data, error } = await publicDb.from("catalog_snapshots").select("payload,source_name").eq("city_slug", "hyderabad").eq("published", true).single();
      if (error || !data || !catalogSchema.safeParse(data.payload).success || !data.source_name) throw new Error("A validated, approved Hyderabad catalog must be published.");
    })(),
    (async () => {
      for (const table of ["customer_states", "viewing_requests", "listing_submissions"]) {
        const { error } = await admin.from(table).select("user_id").limit(0);
        if (error) throw new Error("Customer database migration is missing or inaccessible.");
      }
      const { error } = await admin.rpc("consume_request_budget", { bucket_key: "0".repeat(64), request_limit: 1000, window_seconds: 60 });
      if (error) throw new Error("Distributed request protection is unavailable.");
    })(),
    (async () => {
      const response = await fetch(`${config.url}/auth/v1/settings`, { headers: { apikey: config.key }, signal: AbortSignal.timeout(10_000), cache: "no-store" });
      if (!response.ok) throw new Error("Supabase Auth is unreachable.");
      const settings = await response.json();
      if (!settings.external?.email || !settings.external?.google) throw new Error("Enable email and Google sign-in in Supabase Auth.");
      if (settings.mailer_autoconfirm) throw new Error("Email confirmation must remain enabled.");
    })(),
  ]);
  for (const check of checks) {
    if (check.status !== "rejected") continue;
    const message = check.reason instanceof Error ? check.reason.message : "";
    failures.push(/^(A validated|Customer database|Distributed request|Supabase Auth|Enable email|Email confirmation)/.test(message) ? message : "A production dependency could not be verified.");
  }
  return failures;
}
