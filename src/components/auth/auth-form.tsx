"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Bookmark, Check, CheckCircle2, Loader2, Mail, MapPin, ShieldCheck } from "lucide-react";
import { browserDatabase } from "@/lib/supabase/browser";
import { authCallbackUrl, authPageHref, emailLinkRequest, type AuthMode } from "@/lib/auth/email-link";

const inputClass = "mt-2 h-12 w-full rounded-xl border border-line bg-paper px-4 text-[16px] text-ink outline-none transition-colors placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent-wash disabled:opacity-60";
const buttonClass = "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

export function AuthForm({ mode, next, expired = false }: { mode: AuthMode; next: string; expired?: boolean }) {
  const signup = mode === "signup";
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const [sent, setSent] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(expired ? "That link has expired or was already used. Request a fresh sign-in link below." : null);
  const submitting = useRef(false);
  const coolingDown = secondsLeft > 0;
  useEffect(() => {
    if (!coolingDown) return;
    const timer = setInterval(() => setSecondsLeft(seconds => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [coolingDown]);

  async function sendEmailLink(event?: React.FormEvent) {
    event?.preventDefault();
    if (submitting.current || coolingDown) return;
    const database = browserDatabase();
    if (!database) { setError("Sign-in is temporarily unavailable. Please try again later."); return; }
    submitting.current = true; setBusy("email"); setError(null);
    try {
      const request = emailLinkRequest(mode, email, fullName, window.location.origin, next);
      const { error } = await database.auth.signInWithOtp(request);
      if (error) {
        setError(error.status === 429 ? "Please wait a minute before requesting another link." : "We couldn’t send a link. Check your email and try again. If you’re new here, choose Sign up.");
      } else { setEmail(request.email); setSent(true); setSecondsLeft(60); }
    } catch { setError("We couldn’t send your link. Check your details and connection, then try again."); }
    finally { submitting.current = false; setBusy(null); }
  }

  async function continueWithGoogle() {
    if (submitting.current) return;
    const database = browserDatabase();
    if (!database) { setError("Sign-in is temporarily unavailable. Please try again later."); return; }
    submitting.current = true; setBusy("google"); setError(null);
    try {
      const { data, error } = await database.auth.signInWithOAuth({ provider: "google", options: { redirectTo: authCallbackUrl(window.location.origin, next), skipBrowserRedirect: true } });
      if (error || !data.url) throw new Error("Google sign-in unavailable.");
      window.location.assign(data.url);
    } catch { submitting.current = false; setBusy(null); setError("Google sign-in is temporarily unavailable. Please try an email link."); }
  }

  return <div className="mx-auto grid w-full max-w-[1080px] items-center gap-12 px-5 py-8 sm:py-12 lg:grid-cols-[1fr_440px] lg:gap-20 lg:py-16">
    <aside className="hidden max-w-[460px] lg:block" aria-label="Your PropIT account benefits">
      <span className="inline-flex items-center gap-2 rounded-full border border-line bg-accent-wash px-3 py-1.5 text-xs font-semibold text-accent"><MapPin size={13} />Made for your life in Hyderabad</span>
      <h2 className="display mt-6 text-[58px] leading-[1.06] tracking-[-0.035em]">A place for your<br /><span className="italic text-accent">next chapter.</span></h2>
      <p className="mt-5 max-w-[36ch] text-base leading-relaxed text-muted">Find your neighbourhood. Keep the homes you love. Pick up right where you left off.</p>
      <ul className="mt-9 space-y-5 text-sm">
        {[{ icon: Bookmark, title: "Your shortlist, always with you", text: "Save homes and searches across your devices." }, { icon: MapPin, title: "A map built around your life", text: "Find homes near the places that matter." }, { icon: ShieldCheck, title: "A secure place to come back to", text: "Private saved homes and password-free sign-in." }].map(({ icon: Icon, title, text }) => <li className="flex gap-3" key={title}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-raised text-accent"><Icon size={18} strokeWidth={1.6} /></span><div><p className="font-semibold text-ink">{title}</p><p className="mt-1 text-muted">{text}</p></div></li>)}
      </ul>
    </aside>

    <section className="mx-auto w-full max-w-[460px] rounded-[28px] border border-line bg-raised p-6 shadow-e2 sm:p-8" aria-labelledby="auth-title">
      <nav aria-label="Account access" className="mb-7 grid grid-cols-2 gap-1 rounded-xl border border-line bg-sunk p-1 text-sm font-semibold">
        {(["login", "signup"] as const).map(tab => <Link key={tab} href={authPageHref(tab, next)} aria-current={mode === tab ? "page" : undefined} className={`flex min-h-10 items-center justify-center rounded-lg transition-colors ${mode === tab ? "bg-raised text-ink shadow-e1" : "text-muted hover:text-ink"}`}>{tab === "login" ? "Log in" : "Sign up"}</Link>)}
      </nav>
      {sent ? <>
        <div role="status"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-wash text-accent"><CheckCircle2 size={24} /></span><h1 id="auth-title" className="display mt-5 text-[34px] leading-tight">Check your inbox.</h1><p className="mt-3 break-words text-sm leading-relaxed text-muted">{signup ? "Confirm your email to finish creating your account." : "If an account exists for this email, you’ll receive a secure sign-in link."} Look for it at <strong className="font-semibold text-ink">{email}</strong>.</p><p className="mt-3 text-sm leading-relaxed text-muted">Open the link in your email to continue. Check your spam folder if it hasn’t arrived.</p></div>
        <button type="button" disabled={!!busy || coolingDown} onClick={() => void sendEmailLink()} className={`${buttonClass} mt-6 bg-accent text-accent-ink hover:bg-accent-hover`}>{busy === "email" ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}{coolingDown ? `Resend in ${secondsLeft}s` : "Resend link"}</button>
        <button type="button" onClick={() => { setSent(false); setError(null); }} disabled={!!busy} className="mt-3 min-h-11 w-full text-sm font-semibold text-accent">Use another email</button>
      </> : <>
        <p className="eyebrow">Your PropIT account</p>
        <h1 id="auth-title" className="display mt-3 text-[36px] leading-tight">{signup ? "Make yourself at home." : "Welcome home."}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{signup ? "Create your account to save, compare and find your next home." : "Log in to your saved homes, searches and enquiries."}</p>
        <button type="button" disabled={!!busy} onClick={() => void continueWithGoogle()} className={`${buttonClass} mt-6 border border-line bg-raised text-ink hover:bg-sunk`}>{busy === "google" ? <Loader2 size={17} className="animate-spin" /> : <GoogleMark />}Continue with Google</button>
        <div className="my-5 flex items-center gap-3" aria-hidden="true"><span className="h-px flex-1 bg-line" /><span className="text-xs text-faint">or continue with email</span><span className="h-px flex-1 bg-line" /></div>
        <form onSubmit={sendEmailLink} aria-label={signup ? "Create your account" : "Log in with email"}>
          {signup && <label className="mb-4 block text-sm font-medium" htmlFor="auth-name">Full name<input id="auth-name" name="name" autoComplete="name" required minLength={2} maxLength={80} value={fullName} onChange={event => setFullName(event.target.value)} disabled={!!busy} className={inputClass} placeholder="Your full name" /></label>}
          <label className="block text-sm font-medium" htmlFor="auth-email">Email address<input id="auth-email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={!!busy} className={inputClass} placeholder="you@example.com" /></label>
          <p className="mt-2.5 text-xs leading-relaxed text-muted">We’ll email you a secure link. No password to remember.</p>
          <button type="submit" disabled={!!busy || coolingDown} className={`${buttonClass} mt-5 bg-accent text-accent-ink hover:bg-accent-hover`}>{busy === "email" ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}{coolingDown ? `Try again in ${secondsLeft}s` : signup ? "Create account" : "Send login link"}{!busy && !coolingDown && <ArrowRight size={15} className="ml-auto" />}</button>
        </form>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-faint"><Check size={13} />Secure, password-free access</p>
      </>}
      {error && <p className="mt-4 rounded-xl border border-line bg-sunk p-3 text-sm leading-relaxed text-clay" role="alert">{error}</p>}
      <p className="mt-6 border-t border-line pt-5 text-center text-sm text-muted">{signup ? "Already have an account?" : "New to PropIT?"} <Link href={authPageHref(signup ? "login" : "signup", next)} className="inline-flex min-h-9 items-center font-semibold text-accent">{signup ? "Log in" : "Create an account"}</Link></p>
      <Link href="/" className="mx-auto mt-2 flex min-h-10 w-fit items-center gap-1.5 text-xs font-medium text-muted hover:text-ink"><ArrowLeft size={13} />Continue exploring</Link>
    </section>
  </div>;
}

function GoogleMark() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.5-.1-2.9-.4-4.3H24v8.2h11a9.4 9.4 0 0 1-4.1 6.2V40h6.6c3.9-3.6 6.1-8.9 6.1-15.5Z" /><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20.4 20.4 0 0 0 24 44Z" /><path fill="#FBBC05" d="M12.6 27.6a12.2 12.2 0 0 1 0-7.2v-5.3H5.8a20.5 20.5 0 0 0 0 17.8l6.8-5.3Z" /><path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3l5.8-5.8A19.6 19.6 0 0 0 24 4 20.4 20.4 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12Z" /></svg>;
}
