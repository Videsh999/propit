import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-[560px] flex-col justify-center px-5 py-20 text-center md:px-8">
      <p className="eyebrow mb-3">Not found</p>
      <h1 className="display text-[40px] leading-tight text-ink md:text-[52px]">
        That address doesn&apos;t exist.
      </h1>
      <p className="mx-auto mt-4 max-w-[42ch] text-[15px] leading-relaxed text-muted">
        The home, project or locality you were looking for isn&apos;t on PropIT — it may have been
        removed, or the link may be wrong.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/search"
          className="inline-flex h-11 items-center rounded-[var(--r-pill)] bg-accent px-5 text-[15px] font-medium text-[var(--accent-ink)]"
        >
          Open the map
        </Link>
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-[var(--r-pill)] border border-line px-5 text-[15px] font-medium text-ink transition-colors hover:bg-sunk"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
