"use client";

import { motion } from "motion/react";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * A named area with its live count — the city-scale marker.
 *
 * An anonymous cluster bubble tells you 42 of something is somewhere. This says
 * "Kokapet · 42 homes · from ₹1.15 Cr", which is the actual question a buyer is
 * asking at this zoom. There are only ~40 of these on screen, so they are DOM
 * markers: full control over type and colour, and no dependency on map fonts.
 */
export function LocalityMarker({
  name,
  count,
  minPrice,
  compact = false,
  selected,
  dimmed,
  onClick,
}: {
  name: string;
  count: number;
  minPrice: number;
  /** Where the full name will not fit, the count still shows. */
  compact?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  onClick: () => void;
}) {
  // Weight the marker by inventory so the map reads at a glance.
  const scale = count >= 30 ? 1 : count >= 12 ? 0.94 : 0.88;

  return (
    <motion.button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      initial={{ opacity: 0, scale: 0.86 }}
      animate={{ opacity: dimmed ? 0.45 : 1, scale }}
      whileHover={{ scale: scale * 1.06, opacity: 1 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="group relative cursor-pointer"
      aria-label={`${name}, ${count} homes, from ${formatPrice(minPrice)}`}
    >
      <span
        className={cn(
          "flex items-center gap-2 rounded-full border py-1 shadow-[var(--e2)] backdrop-blur-sm",
          compact ? "pl-1.5 pr-1.5" : "pl-3 pr-1.5",
          "transition-colors duration-[180ms]",
          // The design fills the pin with the deep green and lightens the badge,
          // which reads far better over a busy basemap than a white pill did.
          selected
            ? "border-[var(--accent-deep)] bg-[var(--accent-deep)]"
            : "border-[var(--accent)] bg-[var(--accent)] group-hover:border-[var(--accent-deep)] group-hover:bg-[var(--accent-deep)]",
        )}
      >
        {!compact && (
          <span
            className={cn(
              "whitespace-nowrap text-[12px] font-medium leading-none tracking-[-0.01em]",
              "text-[var(--accent-ink)]",
            )}
          >
            {name}
          </span>
        )}
        <span
          className={cn(
            "tnum grid min-w-[22px] place-items-center rounded-full px-1.5 py-[3px] text-[11px] font-semibold leading-none",
            "bg-[color-mix(in_srgb,var(--accent-ink)_92%,transparent)] text-[var(--accent-deep)]",
          )}
        >
          {count}
        </span>
      </span>

      {/* Price reveal on hover — detail only when asked for. */}
      <span
        className={cn(
          "pointer-events-none absolute left-1/2 top-[calc(100%+5px)] -translate-x-1/2 whitespace-nowrap",
          "rounded-full border border-line bg-[color-mix(in_srgb,var(--paper-raised)_94%,transparent)] px-2 py-0.5",
          "text-[10px] text-muted opacity-0 shadow-[var(--e1)] backdrop-blur-sm",
          "transition-opacity duration-[180ms] group-hover:opacity-100",
        )}
      >
        {compact ? `${name} · from ${formatPrice(minPrice)}` : `from ${formatPrice(minPrice)}`}
      </span>

      {/* The stem that ties the label to its point on the ground. */}
      <span
        aria-hidden
        className={cn(
          "absolute left-1/2 top-full h-1.5 w-px -translate-x-1/2",
          selected ? "bg-[var(--accent-deep)]" : "bg-[var(--accent)]",
        )}
      />
    </motion.button>
  );
}
