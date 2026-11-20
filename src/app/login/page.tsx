import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { safeNextPath } from "@/lib/auth/redirect";
import { supabaseConfig } from "@/lib/deployment";
import { verifiedUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const configured = !!supabaseConfig();
  if (configured && await verifiedUser()) redirect(next);
  return <main><AuthForm mode="login" next={next} configured={configured} expired={!!params.error} /></main>;
}
