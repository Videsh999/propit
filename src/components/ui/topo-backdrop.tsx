"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * Topographic contour lines — the native visual language of land, which is why
 * this and not a particle field.
 *
 * Drawn here rather than imported. This replaced ThreeUI's TopoField, which
 * pulled three.js and the whole effect bundle (~600 KB) into the page and ran
 * inside its own iframe to draw what is, in the end, a few dozen closed curves.
 * These are generated from a fixed formula, so they are identical on server and
 * client, cost one small inline SVG, and animate on the compositor.
 */

const VIEW_W = 1200;
const VIEW_H = 600;

/**
 * One contour ring: a circle in polar coordinates perturbed by three
 * sinusoids and stretched horizontally, so the field reads as terrain seen
 * from above rather than as a bullseye.
 */
function contour(cx: number, cy: number, r: number, phase: number, steps = 128): string {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const wobble =
      Math.sin(t * 3 + phase) * 0.1 +
      Math.sin(t * 5 - phase * 1.7) * 0.055 +
      Math.sin(t * 2 + phase * 0.6) * 0.085;
    const rr = r * (1 + wobble);
    const x = cx + rr * 1.5 * Math.cos(t);
    const y = cy + rr * Math.sin(t);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${d}Z`;
}

interface Peak {
  cx: number;
  cy: number;
  rings: number;
  step: number;
  base: number;
  seed: number;
}

/** Two overlapping rises — one dominant, one at the edge, as real ground is. */
const PEAKS: Peak[] = [
  { cx: 380, cy: 330, rings: 16, step: 26, base: 22, seed: 0.4 },
  { cx: 940, cy: 170, rings: 11, step: 30, base: 30, seed: 2.1 },
];

export function TopoBackdrop({
  mode = "dark",
  opacity = 0.5,
  className,
}: {
  mode?: "light" | "dark";
  opacity?: number;
  className?: string;
}) {
  const paths = useMemo(
    () =>
      PEAKS.flatMap((peak, p) =>
        Array.from({ length: peak.rings }, (_, i) => ({
          key: `${p}-${i}`,
          d: contour(peak.cx, peak.cy, peak.base + i * peak.step, peak.seed + i * 0.42),
          // Contours fade outward: the summit reads first, the skirt suggests.
          opacity: 0.85 - (i / peak.rings) * 0.62,
          // Alternating line weight is how printed topo maps mark index contours.
          width: i % 5 === 0 ? 1.15 : 0.6,
        })),
      ),
    [],
  );

  const stroke = mode === "dark" ? "var(--ink-inverse)" : "var(--ink)";

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={{ opacity }}
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full topo-drift"
        fill="none"
      >
        {paths.map((p) => (
          <path
            key={p.key}
            d={p.d}
            stroke={stroke}
            strokeWidth={p.width}
            strokeOpacity={p.opacity}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}
