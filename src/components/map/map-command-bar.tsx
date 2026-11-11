"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Columns2,
  Layers,
  List,
  Map as MapIcon,
  MapPin,
  Pentagon,
  RefreshCw,
  SquareStack,
  Target,
  X,
} from "lucide-react";
import { useDiscovery, type ViewMode } from "@/store/discovery";
import { NearbyPanel, RadiusPanel } from "@/components/map/map-toolbar";
import type { Locality } from "@/types";
import { cn } from "@/lib/utils";

type LocalityLite = Pick<Locality, "slug" | "name" | "center">;

/**
 * The full discovery surface's command bar.
 *
 * It carries more than the hero toolbar — anchors, the map-wide layer toggles,
 * "search this area", and the list/split/map switch. But Radius and Nearby are
 * the *same* controls the hero uses, imported rather than reimplemented: two
 * radius pickers that behaved differently on two screens of one product is a
 * bug the user experiences as confusion.
 */
export function MapCommandBar({
  boundsDrifted,
  localities,
  activeView,
  onChangeView,
}: {
  boundsDrifted: boolean;
  localities: LocalityLite[];
  activeView?: ViewMode;
  onChangeView?: (mode: ViewMode) => void;
}) {
  const {
    commitBounds, radius, anchors, layers, toggleLayer,
    drawMode, setDrawMode, polygon, setPolygon, viewMode, setViewMode,
    anchorsOpen, setAnchorsOpen,
  } = useDiscovery();
  const [open, setOpen] = useState<"layers" | "radius" | "nearby" | null>(null);

  const activeNearby = Object.entries(layers).filter(
    ([k, v]) => v && !["localities", "projects", "priceHeat"].includes(k),
  ).length;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3">
      <div className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto scroll-quiet rounded-full border border-line bg-[color-mix(in_srgb,var(--paper-raised)_90%,transparent)] p-1 shadow-[var(--e2)] backdrop-blur-xl">
        <AnimatePresence>
          {boundsDrifted && (
            <motion.button
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              onClick={commitBounds}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full bg-accent px-3 text-[12px] font-medium text-[var(--accent-ink)]"
            >
              <RefreshCw size={12} strokeWidth={2} />
              <span className="hidden sm:inline">Search this area</span>
              <span className="sm:hidden">Search here</span>
            </motion.button>
          )}
        </AnimatePresence>

        <Tool
          active={anchorsOpen}
          onClick={() => setAnchorsOpen(!anchorsOpen)}
          icon={MapPin}
          label="Anchors"
          badge={anchors.length || undefined}
        />
        <Tool
          active={!!radius || open === "radius"}
          onClick={() => setOpen(open === "radius" ? null : "radius")}
          icon={Target}
          label="Radius"
        />
        <Tool
          active={drawMode !== "none" || !!polygon}
          onClick={() => {
            if (polygon) {
              setPolygon(null);
              setDrawMode("none");
            } else {
              setDrawMode(drawMode === "polygon" ? "none" : "polygon");
            }
          }}
          icon={polygon ? X : Pentagon}
          label={polygon ? "Clear area" : "Draw"}
        />
        <Tool
          active={open === "nearby" || activeNearby > 0}
          onClick={() => setOpen(open === "nearby" ? null : "nearby")}
          icon={Layers}
          label="Nearby"
          badge={activeNearby || undefined}
        />
        <Tool
          active={open === "layers"}
          onClick={() => setOpen(open === "layers" ? null : "layers")}
          icon={SquareStack}
          label="Layers"
        />

        <span className="mx-0.5 h-5 w-px shrink-0 bg-[var(--line)]" />

        <div className="flex shrink-0 items-center gap-0.5">
          {([
            ["list", List, "List"],
            ["split", Columns2, "Split"],
            ["map", MapIcon, "Map"],
          ] as const).map(([mode, Icon, label]) => (
            <button
              key={mode}
              onClick={() => (onChangeView ?? setViewMode)(mode)}
              aria-label={label}
              aria-pressed={(activeView ?? viewMode) === mode}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-full transition-colors",
                (activeView ?? viewMode) === mode ? "bg-inverse text-[var(--ink-inverse)]" : "text-faint hover:text-ink",
              )}
            >
              <Icon size={13} strokeWidth={1.75} />
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {open === "radius" && (
          <Popover key="radius" onClose={() => setOpen(null)}>
            <RadiusPanel localities={localities} />
          </Popover>
        )}

        {open === "nearby" && (
          <Popover key="nearby" onClose={() => setOpen(null)}>
            <NearbyPanel />
          </Popover>
        )}

        {open === "layers" && (
          <Popover key="layers" onClose={() => setOpen(null)}>
            <p className="eyebrow mb-3">Map layers</p>
            <div className="flex flex-wrap gap-1.5">
              <LayerChip on={layers.localities} onClick={() => toggleLayer("localities")}>
                Locality boundaries
              </LayerChip>
              <LayerChip on={layers.projects} onClick={() => toggleLayer("projects")}>
                Projects
              </LayerChip>
              <LayerChip on={layers.priceHeat} onClick={() => toggleLayer("priceHeat")}>
                Price map
              </LayerChip>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              Schools, metro and the rest live under Nearby.
            </p>
          </Popover>
        )}
      </AnimatePresence>
    </div>
  );
}

function Tool({
  icon: Icon, label, active, onClick, badge,
}: {
  icon: typeof MapPin;
  label: string;
  active?: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2 text-[12px] font-medium transition-colors sm:px-3",
        active ? "bg-accent text-[var(--accent-ink)]" : "text-muted hover:bg-sunk hover:text-ink",
      )}
    >
      <Icon size={13} strokeWidth={1.75} />
      <span className="hidden sm:inline">{label}</span>
      {badge ? <span className="tnum text-[11px] opacity-75">{badge}</span> : null}
    </button>
  );
}

function LayerChip({
  on, onClick, children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[12px] transition-colors",
        on
          ? "border-[var(--accent-line)] bg-[var(--accent-wash)] text-accent"
          : "border-line bg-raised text-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function Popover({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto absolute top-[52px] z-30 w-[min(90vw,340px)] rounded-[var(--r-md)] border border-line bg-raised p-4 shadow-[var(--e3)]"
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-[var(--r-sm)] text-faint transition-colors hover:bg-sunk hover:text-ink"
      >
        <X size={13} strokeWidth={2} />
      </button>
      {children}
    </motion.div>
  );
}
