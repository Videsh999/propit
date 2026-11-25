import { publicSupabaseEnvironment } from "./supabase/environment";

export function isProductionDeployment(): boolean {
  const mode = process.env.PROPIT_MODE?.trim();
  if (mode && mode !== "preview" && mode !== "production") throw new Error("Invalid PROPIT_MODE.");
  return mode === "production" || process.env.VERCEL_ENV === "production";
}

/** Next's local server may normalise 127.0.0.1 to localhost internally. Keep local cookies on the browser's actual host. */
export function requestOrigin(request: Request): string | null {
  if (isProductionDeployment()) return configuredOrigin();
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (host) {
    try {
      const actual = new URL(`${url.protocol}//${host}`);
      if (!actual.username && !actual.password && actual.pathname === "/" && !actual.search && !actual.hash && (["localhost", "127.0.0.1", "[::1]"].includes(actual.hostname) || actual.host === process.env.VERCEL_URL)) return actual.origin;
    } catch { /* Use the framework origin below. */ }
  }
  return url.origin;
}

export function supabaseConfig() {
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key } = publicSupabaseEnvironment();
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))) return null;
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return { url: parsed.origin, key };
  } catch { return null; }
}

/** Backend credentials are never included in Next's public environment mapping. */
export function supabaseServerKey() {
  return process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
}

/** Never use a request Host header to choose where authentication sends users. */
export function configuredOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    if (isProductionDeployment() && (url.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(url.hostname))) return null;
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.origin;
  } catch { return null; }
}
