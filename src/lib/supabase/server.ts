import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseConfig } from "@/lib/deployment";

export async function serverDatabase() {
  const config = supabaseConfig();
  if (!config) return null;
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try { for (const { name, value, options } of values) jar.set(name, value, options); }
        catch { /* Server Components are read-only; Proxy refreshes their cookies. */ }
      },
    },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: init?.signal ?? AbortSignal.timeout(8_000) }) },
  });
}

export async function verifiedUser() {
  const database = await serverDatabase();
  if (!database) return null;
  const { data, error } = await database.auth.getUser();
  return error ? null : data.user;
}
