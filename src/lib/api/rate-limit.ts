import "server-only";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { isProductionDeployment, supabaseConfig } from "@/lib/deployment";
import { HttpError } from "./http";

const local = new Map<string, { count: number; until: number }>();
const policies = { read: 240, search: 120, ai: 15, write: 10, account: 60 } as const;

/** Shared DB counter in production; bounded process-local counters in previews. */
export async function requestBudget(request: Request, scope: keyof typeof policies, userId?: string): Promise<void> {
  const ip = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() : null;
  const identity = userId ?? ip ?? "anonymous";
  const production = isProductionDeployment();
  const secret = process.env.RATE_LIMIT_SECRET?.trim();
  const config = supabaseConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const key = createHmac("sha256", secret || "preview-only").update(`${scope}:${identity}`).digest("hex");
  if (production) {
    if (!config || !secret || secret.length < 32 || !serviceKey) throw new HttpError(503, "The service is temporarily unavailable.", "protection_unavailable");
    const database = createClient(config.url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(5_000) }) } });
    const { data, error } = await database.rpc("consume_request_budget", { bucket_key: key, request_limit: policies[scope], window_seconds: 60 });
    if (error || typeof data !== "boolean") throw new HttpError(503, "The service is temporarily unavailable.", "protection_unavailable");
    if (!data) throw new HttpError(429, "Too many requests. Please wait a minute.", "rate_limited");
    if (scope === "ai" && userId) {
      const globalKey = createHmac("sha256", secret).update("paid-advisor-global").digest("hex");
      const global = await database.rpc("consume_request_budget", { bucket_key: globalKey, request_limit: 100, window_seconds: 60 });
      if (global.error || typeof global.data !== "boolean") throw new HttpError(503, "The advisor is temporarily unavailable.", "protection_unavailable");
      if (!global.data) throw new HttpError(429, "The advisor is busy. Please try again in a minute.", "rate_limited");
    }
    return;
  }
  const now = Date.now();
  if (local.size > 2000) for (const [id, value] of local) if (value.until <= now) local.delete(id);
  let bucket = local.get(key);
  if (!bucket || bucket.until <= now) { bucket = { count: 0, until: now + 60_000 }; local.set(key, bucket); }
  if (++bucket.count > policies[scope]) throw new HttpError(429, "Too many requests. Please wait a minute.", "rate_limited");
}
