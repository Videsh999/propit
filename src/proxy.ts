import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isProductionDeployment, supabaseConfig } from "@/lib/deployment";

export async function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const development = process.env.NODE_ENV === "development";
  // Only published PDF documents may be embedded by this site's reader.
  const documentReader = /^\/(?:brochures|plans)\/[^?]*\.pdf$/i.test(request.nextUrl.pathname);
  const policy = [
    "default-src 'self'", `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https:", "font-src 'self' data:",
    `connect-src 'self' https: wss:${development ? " http: ws:" : ""}`, "worker-src 'self' blob:",
    "media-src 'self' https: blob:", "frame-src 'self' https:", "object-src 'none'", "base-uri 'self'", "form-action 'self'", documentReader ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
  ].join("; ");
  const forwarded = new Headers(request.headers);
  forwarded.set("x-nonce", nonce);
  forwarded.set("x-request-id", crypto.randomUUID());
  forwarded.set("Content-Security-Policy", policy);
  let response = NextResponse.next({ request: { headers: forwarded } });
  const config = supabaseConfig();
  // Avoid an auth network trip for anonymous browsing and static assets.
  if (config && request.cookies.getAll().some(cookie => cookie.name.startsWith("sb-"))) {
    const supabase = createServerClient(config.url, config.key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          const existing = response.cookies.getAll();
          for (const { name, value } of values) request.cookies.set(name, value);
          forwarded.set("cookie", request.headers.get("cookie") ?? "");
          response = NextResponse.next({ request: { headers: forwarded } });
          for (const cookie of existing) response.cookies.set(cookie);
          for (const { name, value, options } of values) response.cookies.set(name, value, options);
        },
      },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(8_000) }) },
    });
    try { await supabase.auth.getClaims(); }
    catch { /* Public pages remain usable; private endpoints verify identity again. */ }
    response.headers.set("Cache-Control", "private, no-store");
  }
  response.headers.set("Content-Security-Policy", policy);
  if (documentReader) response.headers.set("X-Frame-Options", "SAMEORIGIN");
  if (!isProductionDeployment()) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|maplibre/|fonts/|data/|brand/|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"] };
