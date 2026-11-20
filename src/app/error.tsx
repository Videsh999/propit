"use client";
import Link from "next/link";
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-xl px-6 py-20"><h1 className="display text-[40px]">We couldn’t load this page.</h1><p className="mt-4 text-base text-muted">Please try again in a moment, or return to your search.</p>
    {error.digest && <p className="mt-3 text-xs text-muted">Reference: {error.digest}</p>}<div className="mt-7 flex gap-4"><button onClick={reset} className="min-h-11 rounded-xl bg-accent px-5 font-semibold text-accent-ink">Try again</button><Link href="/" className="inline-flex min-h-11 items-center text-accent">Return home</Link></div></main>;
}
