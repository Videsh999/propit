/**
 * The site's public origin, resolved once.
 *
 * `process.env.X ?? "fallback"` is not enough, and this is how the production
 * build broke: `??` only catches `null` and `undefined`, but a platform
 * variable that is *defined and empty* is an entirely normal state — Vercel
 * stores exactly that when a project variable is added without a value. The
 * empty string then sailed past the fallback into `new URL("")`, which throws
 * `ERR_INVALID_URL` while Next was evaluating `metadata`. That happens before
 * any page renders, so the whole build failed on `/_not-found` with no obvious
 * connection to the real cause.
 *
 * So every candidate is trimmed and actually parsed, and the first one that
 * yields a URL wins. Vercel's own deployment host sits behind the explicit
 * setting, which is the right default for preview deployments in any case:
 * their hostname is not known until build time, so no configured value could
 * be correct for them.
 *
 * Kept in one module because three callers need the same answer — the metadata
 * base, the sitemap and robots.txt — and two of them would not have thrown.
 * They would have emitted host-less URLs, which is the worse failure: a sitemap
 * full of `/search` entries is accepted silently and simply never indexes.
 */

/** Candidates in order of authority; empty and malformed entries are skipped. */
function candidates(): (string | undefined)[] {
  return [
    process.env.NEXT_PUBLIC_SITE_URL,
    // Set by Vercel to the project's production domain.
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    // Set by Vercel to this specific deployment's host, preview builds included.
    process.env.VERCEL_URL,
  ];
}

function resolve(): URL {
  for (const raw of candidates()) {
    const value = raw?.trim();
    if (!value) continue;
    // Vercel's host variables carry no scheme; a configured value usually does.
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try {
      return new URL(withScheme);
    } catch {
      // A malformed value should not outrank a working fallback.
    }
  }
  return new URL("http://localhost:3000");
}

export const SITE_URL: URL = resolve();

/** Origin with no trailing slash, for building absolute links by concatenation. */
export const SITE_ORIGIN: string = SITE_URL.origin;
