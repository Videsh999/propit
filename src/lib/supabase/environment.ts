/** Only these two values may be compiled into browser JavaScript. */
export function publicSupabaseEnvironment(env: Record<string, string | undefined> = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() || env.SUPABASE_URL?.trim() || "";
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || env.SUPABASE_PUBLISHABLE_KEY?.trim() || "";
  if (key.startsWith("sb_secret_")) throw new Error("Use a publishable Supabase key for browser configuration.");
  return { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key };
}
