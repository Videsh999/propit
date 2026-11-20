"use client";
export default function GlobalError({ reset }: { reset: () => void }) {
  return <html lang="en"><body style={{ fontFamily: "system-ui, sans-serif", color: "#2f4036", background: "#f7f9f7", padding: "clamp(24px, 8vw, 100px)", maxWidth: 700 }}><h1>PropIT is temporarily unavailable.</h1><p>Please try again in a moment.</p><button onClick={reset} style={{ minHeight: 44, padding: "10px 20px", cursor: "pointer" }}>Try again</button></body></html>;
}
