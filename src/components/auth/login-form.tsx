"use client";
import { useState } from "react";
import Link from "next/link";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { browserDatabase } from "@/lib/supabase/browser";
import { safeNextPath } from "@/lib/auth/redirect";

export function LoginForm({ next, configured, expired }: { next: string; configured: boolean; expired: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(expired ? "That sign-in link has expired or was already used. Request a new one." : null);
  const callback = () => `${window.location.origin}/auth/callback?${new URLSearchParams({ next: safeNextPath(next) })}`;
  async function emailLogin(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const database = browserDatabase();
    if (!database) return;
    setBusy("email"); setError(null);
    try {
      const { error } = await database.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: callback() } });
      if (error) setError("We couldn’t send the link. Please wait a moment and try again.");
      else setSent(true);
    } catch { setError("We couldn’t reach sign-in. Please try again."); }
    finally { setBusy(null); }
  }
  async function googleLogin() {
    if (busy) return;
    const database = browserDatabase();
    if (!database) return;
    setBusy("google"); setError(null);
    try {
      const { error } = await database.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } });
      if (error) { setError("Google sign-in is temporarily unavailable. You can use an email link instead."); setBusy(null); }
    } catch { setError("We couldn’t reach Google sign-in. Please try again."); setBusy(null); }
  }
  return <section className="mx-auto my-12 w-[calc(100%-2rem)] max-w-[460px] rounded-3xl border border-line bg-raised p-6 shadow-e2 sm:my-20 sm:p-9">
    <p className="eyebrow">Your PropIT account</p><h1 className="display mt-3 text-[42px]">Welcome home.</h1>
    <p className="mt-3 text-base text-muted">Sign in securely to keep your homes and enquiries together.</p>
    {!configured ? <div className="mt-7 rounded-xl border border-line bg-sunk p-4 text-sm" role="status">Customer sign-in is being set up. You can continue exploring properties.</div>
      : sent ? <div className="mt-8" role="status"><CheckCircle2 className="text-accent" size={28} /><h2 className="mt-4 text-xl">Check your email</h2><p className="mt-2 text-sm text-muted">Open the sign-in link sent to {email}. Check your spam folder if it hasn’t arrived.</p><button onClick={() => setSent(false)} className="mt-5 min-h-11 font-semibold text-accent">Use a different email</button></div>
      : <div className="mt-7">
        <button disabled={!!busy} onClick={googleLogin} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-raised px-4 text-base font-semibold disabled:opacity-60">{busy === "google" ? <Loader2 className="animate-spin" size={18} /> : <span aria-hidden className="font-bold">G</span>}Continue with Google</button>
        <p className="my-5 text-center text-sm text-muted">or use an email link</p>
        <form onSubmit={emailLogin}><label htmlFor="login-email" className="mb-2 block text-sm font-medium">Email address</label><input id="login-email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} className="h-12 w-full rounded-xl border border-line bg-paper px-4 text-base" placeholder="you@example.com" />
          <button disabled={!!busy} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 font-semibold text-accent-ink disabled:opacity-60">{busy === "email" ? <Loader2 className="animate-spin" size={18} /> : <Mail size={18} />}Send sign-in link</button></form>
      </div>}
    {error && <p className="mt-5 text-sm text-clay" role="alert">{error}</p>}
    <Link href="/" className="mt-7 inline-flex min-h-11 items-center text-sm font-semibold text-accent">Continue browsing</Link>
  </section>;
}
