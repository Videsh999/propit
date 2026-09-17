"use client";

import { useCallback, useState } from "react";
import { cn, hashString } from "@/lib/utils";

/**
 * Widths offered to the browser. Chosen against the layouts that actually
 * exist — a table thumbnail, a card, a half-width editorial block, a full-bleed
 * hero — rather than a generic ladder.
 */
const WIDTHS = [400, 640, 960, 1280, 1920];

/**
 * Build a srcset from an Unsplash URL by rewriting its own `w` parameter.
 *
 * The source is already a resizing CDN, so responsive images cost nothing but
 * the right query string — routing these through Next's optimiser would add a
 * hop and a cache to re-derive what Unsplash serves directly. Any other host
 * falls through to a plain src, which is always correct if not optimal.
 */
function srcSetFor(src: string): string | undefined {
  if (!src.includes("images.unsplash.com")) return undefined;
  try {
    const url = new URL(src);
    return WIDTHS.map((w) => {
      url.searchParams.set("w", String(w));
      return `${url.toString()} ${w}w`;
    }).join(", ");
  } catch {
    return undefined;
  }
}

/**
 * Image with a deterministic tonal fallback. A dead remote image degrades to a
 * warm gradient rather than a broken icon, so the page never looks unfinished.
 */
export function Img({
  src,
  alt,
  className,
  seed,
  priority,
  sizes,
}: {
  src: string;
  alt: string;
  className?: string;
  seed?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  /**
   * A cached image can finish decoding before React attaches `onLoad`, which
   * would leave it faded out forever. Checking `complete` when the node mounts
   * closes that race.
   */
  const attach = useCallback((node: HTMLImageElement | null) => {
    if (!node) return;
    if (node.complete) setState(node.naturalWidth > 0 ? "ok" : "error");
  }, []);

  const h = hashString(seed ?? src);
  const hue = 24 + (h % 34);
  const l1 = 78 + (h % 9);
  const l2 = 62 + (h % 11);

  return (
    <span className={cn("relative block overflow-hidden bg-sunk", className)}>
      {state !== "ok" && (
        <span
          aria-hidden
          className={cn("absolute inset-0", state === "loading" && "skeleton")}
          style={
            state === "error"
              ? {
                  background: `linear-gradient(148deg, hsl(${hue} 22% ${l1}%), hsl(${hue + 12} 18% ${l2}%))`,
                }
              : undefined
          }
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={attach}
        src={src}
        srcSet={srcSetFor(src)}
        alt={alt}
        sizes={sizes ?? "100vw"}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setState("ok")}
        onError={() => setState("error")}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-500",
          state === "ok" ? "opacity-100" : "opacity-0",
        )}
      />
    </span>
  );
}
