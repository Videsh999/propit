import { NextResponse } from "next/server";
import { serverDatabase } from "@/lib/supabase/server";
import { checkSameOrigin, apiError } from "@/lib/api/http";
import { requestOrigin } from "@/lib/deployment";

export async function POST(request: Request) {
  try {
    checkSameOrigin(request);
    const database = await serverDatabase();
    if (database) { const { error } = await database.auth.signOut(); if (error) throw error; }
    const origin = requestOrigin(request);
    if (!origin) throw new Error("Missing site origin.");
    const response = NextResponse.redirect(new URL("/login", origin), 303); response.headers.set("Cache-Control", "private, no-store"); return response;
  } catch (error) { return apiError(error); }
}
