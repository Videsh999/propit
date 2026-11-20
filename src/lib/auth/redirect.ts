export function safeNextPath(value: string | null | undefined, fallback = "/profile"): string {
  if (!value || value.length > 1000) return fallback;
  let decoded = value;
  try {
    for (let n = 0; n < 3; n++) {
      if (/[\\\u0000-\u0020\u007f]/.test(decoded) || !decoded.startsWith("/") || decoded.startsWith("//")) return fallback;
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    const url = new URL(decoded, "https://propit.invalid");
    if (url.origin !== "https://propit.invalid" || url.pathname.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(decoded)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch { return fallback; }
}
