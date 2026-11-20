import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/deployment";
import { HttpError } from "@/lib/api/http";

/** Only called after server-side identity verification; never imported by a client component. */
export function serviceDatabase() {
  const config = supabaseConfig(), secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!config || !secret) throw new HttpError(503, "Requests are temporarily unavailable.", "service_not_configured");
  return createClient(config.url, secret, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(8000) }) } });
}
