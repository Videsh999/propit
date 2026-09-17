"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks/use-media-query";
import { formatCount } from "@/lib/format";

/**
 * A number that counts to its new value rather than swapping to it.
 *
 * The result count is the map's answer to whatever the user just did, so it
 * should read as a consequence of the action: a hard swap looks like a page
 * change, a short count reads as the map recalculating. Reduced motion renders
 * the value directly rather than animating to it.
 */
export function AnimatedCount({ value, duration = 420 }: { value: number; duration?: number }) {
  const reduce = usePrefersReducedMotion();
  const [display, setDisplay] = useState(value);
  const shown = useRef(value);

  useEffect(() => {
    if (reduce || shown.current === value) return;
    const from = shown.current;
    const start = performance.now();

    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const next = Math.round(from + (value - from) * (1 - Math.pow(1 - p, 3)));
      shown.current = next;
      setDisplay(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduce]);

  return <span className="tnum">{formatCount(reduce ? value : display)}</span>;
}
