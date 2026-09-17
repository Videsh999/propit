"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Maximize2, Scan } from "lucide-react";
import Link from "next/link";
import { useDiscovery } from "@/store/discovery";
import { AnimatedCount } from "@/components/ui/animated-count";
import { ORR_BBOX } from "@/lib/map/viewport";
import type { Locality } from "@/types";
import { cn } from "@/lib/utils";

type LocalityLite = Pick<Locality, "slug" | "name" | "center">;

/**
 * What the map is currently answering.
 *
 * One sentence, phrased the way the constraint was expressed — "within 3 km of
 * your office", not "radius filter active". The breadcrumb says where you are,
 * and Reset view is always one click from the whole city, so no amount of
 * panning can strand the user.
 */
export function MapStatusBar({
  total,
  isLoading,
  localities,
  expandHref,
}: {
  total: number;
  isLoading?: boolean;
  localities: LocalityLite[];
  /** When set, offers a way through to the full map surface. */
  expandHref?: string;
}) {
  const radius = useDiscovery((s) => s.radius);
  const anchors = useDiscovery((s) => s.anchors);
  const polygon = useDiscovery((s) => s.polygon);
  const selectedSlug = useDiscovery((s) => s.selectedLocalitySlug);
  const fitBounds = useDiscovery((s) => s.fitBounds);

  const selected = localities.find((l) => l.slug === selectedSlug);

  // Most specific constraint wins — that is the one the user set most recently
  // and the one they are reasoning about.
  const constraint = polygon
    ? "in the area you drew"
    : radius
      ? `within ${radius.km} km of ${radius.label}`
      : anchors.length === 1
        ? `within ${anchors[0].maxKm} km of your ${anchors[0].label.toLowerCase()}`
        : anchors.length > 1
          ? `near all ${anchors.length} of your places`
          : selected
            ? `in ${selected.name}`
            : "across Hyderabad";

  const resetView = () => {
    const d = useDiscovery.getState();
    d.selectLocality(null);
    d.select(null);
    d.setUseBounds(false);
    fitBounds({
      west: ORR_BBOX.west,
      south: ORR_BBOX.south,
      east: ORR_BBOX.east,
      north: ORR_BBOX.north,
    });
  };

  const isReset = !selected && !radius && !polygon;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-end justify-between gap-2 p-3 pb-7 md:p-4 md:pb-8">
      <Pill className="max-w-full">
        {isLoading ? (
          <span className="text-faint">Counting homes…</span>
        ) : (
          <span className="truncate">
            <span className="font-semibold text-ink">
              <AnimatedCount value={total} />
            </span>{" "}
            <span className="text-muted">
              {total === 1 ? "home" : "homes"} {constraint}
            </span>
          </span>
        )}
      </Pill>

      <div className="flex shrink-0 items-center gap-2">
        <AnimatePresence initial={false}>
          {selected && (
            <motion.div
              key="crumb"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <Pill>
                <button
                  onClick={resetView}
                  className="text-muted transition-colors hover:text-ink"
                >
                  Hyderabad
                </button>
                <ChevronRight size={11} strokeWidth={2} className="mx-0.5 inline text-faint" />
                <span className="font-medium text-ink">{selected.name}</span>
              </Pill>
            </motion.div>
          )}
        </AnimatePresence>

        {expandHref && (
          <Link
            href={expandHref}
            onClick={() => useDiscovery.getState().setViewMode("map")}
            className="pointer-events-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line bg-[color-mix(in_srgb,var(--paper-raised)_92%,transparent)] px-3 text-[12px] font-medium text-ink shadow-[var(--e1)] backdrop-blur-md transition-colors hover:border-line-strong"
          >
            <Maximize2 size={12} strokeWidth={2} />
            Expand map
          </Link>
        )}

        {/* Offered only once there is something to undo. A permanently
            greyed-out button is clutter that teaches the user nothing. */}
        <AnimatePresence initial={false}>
          {!isReset && (
            <motion.button
              key="reset"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              onClick={resetView}
              className="pointer-events-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line bg-[color-mix(in_srgb,var(--paper-raised)_92%,transparent)] px-3 text-[12px] font-medium text-ink shadow-[var(--e1)] backdrop-blur-md transition-colors hover:border-line-strong"
            >
              <Scan size={12} strokeWidth={2} />
              Reset view
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-auto flex h-8 items-center rounded-full border border-line bg-[color-mix(in_srgb,var(--paper-raised)_92%,transparent)] px-3.5 text-[12px] shadow-[var(--e1)] backdrop-blur-md",
        className,
      )}
    >
      {children}
    </div>
  );
}
