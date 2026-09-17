"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { usePrefersReducedMotion } from "@/lib/hooks/use-media-query";
import type { StoryData } from "@/lib/story/story-data";

/**
 * The livable zone, drawn from real data.
 *
 * This began as a homepage section with its own headline and a three-step
 * explanation beside it. It came off the homepage for a simple reason: the hero
 * directly above it already *performs* this — you name your office and your
 * child's school, and the map answers — so a section explaining the mechanic was
 * narrating something the reader had just done. It read as dead space, which is
 * usually what redundancy looks like from the outside.
 *
 * Here it earns its place: the surrounding prose on /about makes the claim in
 * words, and this is the only thing on the page that measures it — the actual
 * Outer Ring Road, an actual office and school, their true radii, the real
 * intersection between them, and the real homes inside it.
 */
export function LifeDiagram({ data }: { data: StoryData }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const reduce = usePrefersReducedMotion();
  const on = reduce || inView;

  const { office, school, officeRadius, schoolRadius, homeDots, orrPath } = data;

  /**
   * Frame the pair, not the city.
   *
   * At the full 1000-unit extent a 6 km and a 5 km disc are a thumbprint in the
   * middle of the ring: the lens is invisible and the two labels sit on top of
   * one another. Cropping is not a distortion — the geometry is untouched, the
   * camera just moves in, and the ring still runs through frame.
   */
  const cx = (office.x + school.x) / 2;
  const cy = (office.y + school.y) / 2;
  const reach =
    Math.hypot(office.x - school.x, office.y - school.y) / 2 +
    Math.max(officeRadius, schoolRadius);
  const span = Math.round(reach * 2.5);
  const viewBox = `${Math.round(cx - span / 2)} ${Math.round(cy - span / 2)} ${span} ${span}`;
  // Sizes are authored against the 1000-unit frame, so scale them with the crop
  // to keep strokes and type at a constant weight on screen.
  const u = (n: number) => +(n * (span / 1000)).toFixed(2);

  const pop = (delay: number) => ({
    initial: reduce ? false : { scale: 0, opacity: 0 },
    animate: on ? { scale: 1, opacity: 1 } : undefined,
    transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <figure ref={ref} className="my-12 border-y border-line py-10">
      <div className="relative mx-auto aspect-square w-full max-w-[440px] overflow-hidden">
        <svg
          viewBox={viewBox}
          className="h-full w-full"
          role="img"
          aria-label={`The Outer Ring Road with ${office.name} and ${school.name} marked, and the homes within reach of both`}
        >
          <defs>
            {/* A true intersection: the school's disc clipped by the office's. */}
            <clipPath id="about-office-clip">
              <circle cx={office.x} cy={office.y} r={officeRadius} />
            </clipPath>
          </defs>

          <motion.path
            d={orrPath}
            fill="none"
            stroke="var(--data-brass)"
            strokeWidth={u(2.5)}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={on ? { pathLength: 1, opacity: 0.55 } : undefined}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          />

          {[
            { cx: office.x, cy: office.y, r: officeRadius, delay: 0.7 },
            { cx: school.x, cy: school.y, r: schoolRadius, delay: 0.9 },
          ].map((c) => (
            <motion.circle
              key={`${c.cx}-${c.cy}`}
              cx={c.cx}
              cy={c.cy}
              r={c.r}
              fill="var(--accent)"
              fillOpacity={0.06}
              stroke="var(--accent)"
              strokeOpacity={0.35}
              strokeWidth={u(1.5)}
              strokeDasharray={`${u(5)} ${u(4)}`}
              style={{ transformOrigin: `${c.cx}px ${c.cy}px` }}
              {...pop(c.delay)}
            />
          ))}

          <motion.g
            clipPath="url(#about-office-clip)"
            initial={reduce ? false : { opacity: 0 }}
            animate={on ? { opacity: 1 } : undefined}
            transition={{ duration: 0.6, delay: 1.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <circle
              cx={school.x}
              cy={school.y}
              r={schoolRadius}
              fill="var(--accent)"
              fillOpacity={0.2}
              stroke="var(--accent)"
              strokeWidth={u(2)}
            />
          </motion.g>

          {homeDots.map((h, i) => (
            <motion.circle
              key={`${h.x}-${h.y}-${i}`}
              cx={h.x}
              cy={h.y}
              r={u(5)}
              fill="var(--accent-deep)"
              initial={reduce ? false : { opacity: 0, scale: 0 }}
              animate={on ? { opacity: 1, scale: 1 } : undefined}
              style={{ transformOrigin: `${h.x}px ${h.y}px` }}
              transition={{
                duration: 0.35,
                delay: 1.45 + Math.min(i, 60) * 0.008,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          ))}

          {/* The lower marker takes the lower label, so the two names never
              collapse into the gap between them. */}
          <Anchor
            x={office.x}
            y={office.y}
            label={office.name}
            on={on}
            reduce={reduce}
            delay={0.8}
            u={u}
            below={office.y > school.y}
          />
          <Anchor
            x={school.x}
            y={school.y}
            label={school.name}
            on={on}
            reduce={reduce}
            delay={1.0}
            u={u}
            below={school.y > office.y}
          />
        </svg>
      </div>

      <figcaption className="mt-8">
        <p className="text-[15px] leading-relaxed text-ink">
          {data.officeKm} km from an office in {office.name}, {data.schoolKm} km from a school in{" "}
          {school.name}. {data.totalHomes.toLocaleString("en-IN")} homes satisfy both.
        </p>

        {data.zoneLocalities.length > 0 && (
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-4">
            {data.zoneLocalities.map((l) => (
              <div key={l.name}>
                <dt className="truncate text-[14px] font-medium text-ink">{l.name}</dt>
                <dd className="tnum mt-0.5 text-[13px] text-muted">
                  {l.count} {l.count === 1 ? "home" : "homes"}
                  <span className="block text-[12px] text-faint">from {l.fromPrice}</span>
                </dd>
              </div>
            ))}
          </dl>
        )}

        <p className="mt-5 text-[12px] leading-relaxed text-faint">
          Outer Ring Road from OpenStreetMap relation 5634923. Homes are development data.
        </p>
      </figcaption>
    </figure>
  );
}

function Anchor({
  x,
  y,
  label,
  on,
  reduce,
  delay,
  below,
  u,
}: {
  x: number;
  y: number;
  label: string;
  on: boolean;
  reduce: boolean;
  delay: number;
  below?: boolean;
  u: (n: number) => number;
}) {
  return (
    <motion.g
      initial={reduce ? false : { opacity: 0, scale: 0.6 }}
      animate={on ? { opacity: 1, scale: 1 } : undefined}
      style={{ transformOrigin: `${x}px ${y}px` }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <circle
        cx={x}
        cy={y}
        r={u(13)}
        fill="var(--paper)"
        stroke="var(--accent)"
        strokeWidth={u(4)}
      />
      {/* Painted twice: a halo underneath keeps the name readable where it
          crosses the lens, which is exactly where the names want to sit. */}
      <text
        x={x}
        y={below ? y + u(46) : y - u(30)}
        textAnchor="middle"
        stroke="var(--paper)"
        strokeWidth={u(7)}
        strokeLinejoin="round"
        className="fill-[var(--ink)]"
        style={{ fontSize: u(30), fontWeight: 500, paintOrder: "stroke" }}
      >
        {label}
      </text>
    </motion.g>
  );
}
