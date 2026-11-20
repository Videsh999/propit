import { NextResponse } from "next/server";
import { serverDatabase } from "@/lib/supabase/server";
import { requestOrigin } from "@/lib/deployment";
import { safeNextPath } from "@/lib/auth/redirect";

export async function GET(request: Request) {
  const url = new URL(request.url), next = safeNextPath(url.searchParams.get("next"));
  const origin = requestOrigin(request);
  if (!origin) return Response.json({ error: "Sign-in is temporarily unavailable." }, { status: 503 });
  const token_hash = url.searchParams.get("token_hash");
  const database = await serverDatabase();
  if (database && token_hash && token_hash.length < 2048 && url.searchParams.get("type") === "email") {
    try { const { error } = await database.auth.verifyOtp({ token_hash, type: "email" });
      if (!error) { const response = NextResponse.redirect(new URL(next, origin)); response.headers.set("Cache-Control", "private, no-store"); return response; }
    } catch { /* Link recovery below. */ }
  }
  const target = new URL("/login", origin); target.searchParams.set("error", "link_expired"); target.searchParams.set("next", next);
  const response = NextResponse.redirect(target); response.headers.set("Cache-Control", "private, no-store"); return response;
}
