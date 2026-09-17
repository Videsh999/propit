import Link from "next/link";
import { PropitMark } from "@/components/nav/propit-mark";
import { cn } from "@/lib/utils";

/**
 * The PropIT lockup: the globe mark, then the two-tone wordmark.
 *
 * The wordmark is live text rather than part of the image, for three reasons
 * that all matter at this size: it stays crisp at every pixel ratio, it
 * inherits the theme (the navy half has to lighten on black or it vanishes),
 * and it remains selectable and readable to a screen reader.
 *
 * The mark itself is drawn, not loaded — see `propit-mark.tsx` for why a 1254px
 * 3D render cannot be shown at 28px. That also means the lockup has no asset
 * dependency: it is correct on a cold clone with nothing in `public/brand`.
 */
export function Logo({
  size = "md",
  href = "/",
  className,
}: {
  size?: "sm" | "md" | "lg";
  /** Pass `null` to render the lockup without wrapping it in a link. */
  href?: string | null;
  className?: string;
}) {
  const S = {
    sm: { mark: "h-6 w-6", text: "text-[17px]", gap: "gap-2" },
    md: { mark: "h-7 w-7", text: "text-[21px]", gap: "gap-2.5" },
    lg: { mark: "h-9 w-9", text: "text-[26px]", gap: "gap-3" },
  }[size];

  const lockup = (
    <span className={cn("inline-flex items-center", S.gap, className)}>
      <PropitMark className={cn("shrink-0", S.mark)} />
      <span
        className={cn(
          "font-semibold leading-none tracking-[-0.02em] [font-family:var(--font-display)]",
          S.text,
        )}
      >
        <span style={{ color: "var(--brand-navy)" }}>Prop</span>
        <span style={{ color: "var(--brand-gold)" }}>IT</span>
      </span>
    </span>
  );

  if (href === null) return lockup;
  return (
    <Link href={href} aria-label="PropIT home" className="shrink-0">
      {lockup}
    </Link>
  );
}
