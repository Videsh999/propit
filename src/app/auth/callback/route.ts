import { NextResponse } from "next/server";
import { serverDatabase } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { requestOrigin } from "@/lib/deployment";

export async function GET(request: Request) {
  const url = new URL(request.url), next = safeNextPath(url.searchParams.get("next"));
  const origin = requestOrigin(request);
  if (!origin) return Response.json({ error: "Sign-in is temporarily unavailable." }, { status: 503 });
  const database = await serverDatabase();
  const code = url.searchParams.get("code");
  if (database && code && code.length < 2048) {
    try {
      const { error } = await database.auth.exchangeCodeForSession(code);
      if (!error) { const response = NextResponse.redirect(new URL(next, origin)); response.headers.set("Cache-Control", "private, no-store"); return response; }
    } catch { /* Show a recoverable sign-in screen; never expose provider errors or tokens. */ }
  }
  const target = new URL("/login", origin);
  target.searchParams.set("error", "link_expired"); target.searchParams.set("next", next);
  const response = NextResponse.redirect(target); response.headers.set("Cache-Control", "private, no-store"); return response;
}
