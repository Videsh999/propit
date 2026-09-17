"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Building2,
  Circle,
  Dumbbell,
  GraduationCap,
  Layers,
  Pencil,
  Plane,
  Radius as RadiusIcon,
  RefreshCw,
  Square,
  ShoppingBag,
  Stethoscope,
  Trees,
  TramFront,
  Trophy,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useDiscovery, type DrawMode } from "@/store/discovery";
import { usePoiViewport } from "@/lib/hooks/use-poi-viewport";
import { useBoundsDrift } from "@/lib/hooks/use-bounds-drift";
import { POI_CATEGORY_LABEL } from "@/lib/data/pois";
import type { LatLng, Locality, PoiCategory } from "@/types";
import { haversineKm } from "@/lib/geo/distance";
import { cn } from "@/lib/utils";

type LocalityLite = Pick<Locality, "slug" | "name" | "center">;

const PRESET_KM = [1, 2, 3, 5, 10];
const MIN_KM = 0.5;
const MAX_KM = 20;

/**
 * Categories offered in the Nearby panel, in the order a buyer asks about them.
 * Railway and temples exist in the data but are not headline decisions, so they
 * stay out of the panel rather than padding it.
 */
const NEARBY: { cat: PoiCategory; icon: typeof GraduationCap }[] = [
  { cat: "school", icon: GraduationCap },
  { cat: "hospital", icon: Stethoscope },
  { cat: "metro", icon: TramFront },
  { cat: "office_hub", icon: Building2 },
  { cat: "mall", icon: ShoppingBag },
  { cat: "park", icon: Trees },
  { cat: "stadium", icon: Trophy },
  { cat: "restaurant", icon: UtensilsCrossed },
  { cat: "gym", icon: Dumbbell },
  { cat: "airport", icon: Plane },
];

const DRAW_SHAPES: { mode: Exclude<DrawMode, "none">; icon: typeof Circle; label: string; hint: string }[] = [
  { mode: "circle", icon: Circle, label: "Circle", hint: "Drag out from a centre point." },
  { mode: "rectangle", icon: Square, label: "Rectangle", hint: "Drag one corner to the other." },
  { mode: "polygon", icon: Pencil, label: "Shape", hint: "Click corners, then close it." },
];

type Panel = "radius" | "draw" | "nearby" | null;

/**
 * The map's own controls.
 *
 * These sit on the map rather than beside it because each one changes what the
 * map is showing — a radius, an area, a layer. Putting them in a side panel
 * would make the map look like output instead of the instrument it is.
 */
export function MapToolbar({ localities }: { localities: LocalityLite[] }) {
  const [panel, setPanel] = useState<Panel>(null);
  const radius = useDiscovery((s) => s.radius);
  const polygon = useDiscovery((s) => s.polygon);
  const drawMode = useDiscovery((s) => s.drawMode);
  const layers = useDiscovery((s) => s.layers);
  const drifted = useBoundsDrift();
  const commitBounds = useDiscovery((s) => s.commitBounds);
  const ref = useRef<HTMLDivElement>(null);

  const activeNearby = NEARBY.filter(({ cat }) => layers[cat]).length;

  // Click-away and Escape both close the open panel — a popover that traps the
  // user on a map they are trying to drag is worse than no popover.
  useEffect(() => {
    if (!panel) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setPanel(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [panel]);

  const toggle = (next: Exclude<Panel, null>) => setPanel((p) => (p === next ? null : next));

  return (
    <div ref={ref} className="pointer-events-none absolute left-3 top-3 z-20 md:left-4 md:top-4">
      <div className="pointer-events-auto inline-flex items-center gap-0.5 rounded-full border border-line bg-[color-mix(in_srgb,var(--paper-raised)_92%,transparent)] p-1 shadow-[var(--e2)] backdrop-blur-xl">
        {/* Only offered once the user has actually gone somewhere else — an
            always-present "search here" button asks a question nobody had. */}
        <AnimatePresence>
          {drifted && (
            <motion.button
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={commitBounds}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full bg-accent px-3.5 text-[13px] font-medium text-[var(--accent-ink)] sm:h-8 sm:px-3"
            >
              <RefreshCw size={13} strokeWidth={2} />
              Search this area
            </motion.button>
          )}
        </AnimatePresence>
        <Tool
          icon={RadiusIcon}
          label="Radius"
          active={panel === "radius" || !!radius}
          onClick={() => toggle("radius")}
        />
        <Tool
          icon={polygon ? X : Circle}
          label={polygon ? "Clear area" : "Draw"}
          active={panel === "draw" || drawMode !== "none" || !!polygon}
          onClick={() => {
            if (polygon) {
              useDiscovery.getState().setPolygon(null);
              useDiscovery.getState().setDrawMode("none");
              setPanel(null);
              return;
            }
            toggle("draw");
          }}
        />
        <Tool
          icon={Layers}
          label="Nearby"
          active={panel === "nearby" || activeNearby > 0}
          badge={activeNearby || undefined}
          onClick={() => toggle("nearby")}
        />
      </div>

      <AnimatePresence>
        {panel === "radius" && (
          <Panel key="radius" onClose={() => setPanel(null)}>
            <RadiusPanel localities={localities} />
          </Panel>
        )}
        {panel === "draw" && (
          <Panel key="draw" onClose={() => setPanel(null)}>
            <DrawPanel onPicked={() => setPanel(null)} />
          </Panel>
        )}
        {panel === "nearby" && (
          <Panel key="nearby" onClose={() => setPanel(null)}>
            <NearbyPanel />
          </Panel>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Radius
// ---------------------------------------------------------------------------

/**
 * Where a radius is measured from.
 *
 * In order of how deliberate the choice was: a radius the user already placed,
 * then the locality they selected, then a place they anchored, and finally
 * wherever the map is looking — named by the locality nearest its centre, so
 * the panel can always say "radius from somewhere" rather than "from here".
 */
function useRadiusOrigin(localities: LocalityLite[]): { center: LatLng; label: string } | null {
  const radius = useDiscovery((s) => s.radius);
  const selectedSlug = useDiscovery((s) => s.selectedLocalitySlug);
  const anchors = useDiscovery((s) => s.anchors);
  const bounds = useDiscovery((s) => s.bounds);

  return useMemo(() => {
    if (radius) return { center: radius.center, label: radius.label };

    const selected = localities.find((l) => l.slug === selectedSlug);
    if (selected) return { center: selected.center, label: selected.name };

    if (anchors[0]) return { center: anchors[0].location, label: anchors[0].address || anchors[0].label };

    if (!bounds) return null;
    const center = {
      lat: (bounds.north + bounds.south) / 2,
      lng: (bounds.east + bounds.west) / 2,
    };
    let nearest: LocalityLite | null = null;
    let best = Infinity;
    for (const l of localities) {
      const d = haversineKm(center, l.center);
      if (d < best) {
        best = d;
        nearest = l;
      }
    }
    return { center, label: nearest?.name ?? "the map centre" };
  }, [radius, selectedSlug, anchors, bounds, localities]);
}

export function RadiusPanel({ localities }: { localities: LocalityLite[] }) {
  const radius = useDiscovery((s) => s.radius);
  const setRadius = useDiscovery((s) => s.setRadius);
  const setUseBounds = useDiscovery((s) => s.setUseBounds);
  const origin = useRadiusOrigin(localities);

  // Draft lets the slider track the thumb smoothly while the committed radius
  // — which costs a query — only changes when the user lets go.
  const [draft, setDraft] = useState<number | null>(null);
  const km = draft ?? radius?.km ?? 5;

  if (!origin) {
    return <p className="text-[12px] leading-relaxed text-faint">Waiting for the map to settle.</p>;
  }

  const commit = (next: number) => {
    setUseBounds(false);
    setRadius({ center: origin.center, km: next, label: origin.label, anchorId: radius?.anchorId });
  };

  return (
    <>
      <p className="eyebrow mb-3">Radius from {origin.label}</p>

      {/* A fixed five-column grid rather than flex-wrap: the presets are one
          scale, and "10 km" dropping onto its own line broke that reading. */}
      <div className="grid grid-cols-5 gap-1.5">
        {PRESET_KM.map((preset) => (
          <button
            key={preset}
            onClick={() => {
              setDraft(null);
              commit(preset);
            }}
            aria-pressed={radius?.km === preset}
            className={cn(
              "tnum h-8 rounded-[var(--r-sm)] border text-[13px] transition-colors duration-[160ms]",
              radius?.km === preset
                ? "border-[var(--accent)] bg-accent text-[var(--accent-ink)]"
                : "border-line bg-raised text-ink hover:border-line-strong",
            )}
          >
            {preset}
            <span className="ml-0.5 text-[11px] opacity-70">km</span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <input
          type="range"
          min={MIN_KM}
          max={MAX_KM}
          step={0.5}
          value={km}
          aria-label="Search radius in kilometres"
          onChange={(e) => setDraft(Number(e.target.value))}
          onPointerUp={() => {
            if (draft != null) commit(draft);
            setDraft(null);
          }}
          onKeyUp={() => {
            if (draft != null) commit(draft);
            setDraft(null);
          }}
          className="propit-range min-w-0 flex-1"
          style={{ ["--fill" as string]: `${((km - MIN_KM) / (MAX_KM - MIN_KM)) * 100}%` }}
        />
        <span className="tnum w-[58px] shrink-0 text-right text-[13px] font-medium text-ink">
          {km} km
        </span>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        Homes outside the ring fade rather than disappear, so you keep your bearings.
      </p>

      {radius && (
        <button
          onClick={() => {
            setDraft(null);
            setRadius(null);
          }}
          className="mt-3 text-[12px] text-muted underline decoration-[var(--line-strong)] underline-offset-4 transition-colors hover:text-ink"
        >
          Clear the radius
        </button>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Draw
// ---------------------------------------------------------------------------

function DrawPanel({ onPicked }: { onPicked: () => void }) {
  const drawMode = useDiscovery((s) => s.drawMode);
  const setDrawMode = useDiscovery((s) => s.setDrawMode);

  return (
    <>
      <p className="eyebrow mb-3">Draw your own area</p>
      <div className="grid gap-1">
        {DRAW_SHAPES.map(({ mode, icon: Icon, label, hint }) => (
          <button
            key={mode}
            onClick={() => {
              setDrawMode(mode);
              onPicked();
            }}
            aria-pressed={drawMode === mode}
            className={cn(
              "flex items-center gap-3 rounded-[var(--r-sm)] px-2 py-2 text-left transition-colors duration-[160ms]",
              drawMode === mode ? "bg-[var(--accent-wash)]" : "hover:bg-sunk",
            )}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sunk text-muted">
              <Icon size={14} strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] text-ink">{label}</span>
              <span className="block text-[11px] text-faint">{hint}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        Only homes inside the shape are counted. Press Esc to cancel.
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Nearby
// ---------------------------------------------------------------------------

export function NearbyPanel() {
  const layers = useDiscovery((s) => s.layers);
  const toggleLayer = useDiscovery((s) => s.toggleLayer);
  const { data, isLoading } = usePoiViewport();

  const rows = NEARBY.map(({ cat, icon }) => ({
    cat,
    icon,
    label: POI_CATEGORY_LABEL[cat],
    count: data.counts[cat] ?? 0,
    on: !!layers[cat],
  })).filter((r) => r.count > 0 || r.on);

  return (
    <>
      <p className="eyebrow mb-2.5">Nearby places</p>

      {isLoading && rows.length === 0 ? (
        <p className="py-2 text-[12px] text-faint">Counting what&apos;s around…</p>
      ) : rows.length === 0 ? (
        <p className="py-2 text-[12px] leading-relaxed text-faint">
          Nothing catalogued in this view. Zoom out, or move over a built-up area.
        </p>
      ) : (
        <ul className="-mx-1">
          {rows.map(({ cat, icon: Icon, label, count, on }) => (
            <li key={cat}>
              <button
                onClick={() => toggleLayer(cat)}
                aria-pressed={on}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[var(--r-sm)] px-1.5 py-1.5 text-left transition-colors duration-[160ms]",
                  on ? "bg-[var(--accent-wash)]" : "hover:bg-sunk",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors duration-[160ms]",
                    on ? "bg-accent text-[var(--accent-ink)]" : "bg-sunk text-muted",
                  )}
                >
                  <Icon size={14} strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{label}</span>
                <span className="tnum shrink-0 text-[12px] text-faint">{count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        Counts are for what the map is showing now.
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

function Tool({
  icon: Icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: typeof RadiusIcon;
  label: string;
  active?: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors duration-[160ms] sm:h-8 sm:px-3",
        active
          ? "bg-accent text-[var(--accent-ink)]"
          : "text-muted hover:bg-sunk hover:text-ink",
      )}
    >
      <Icon size={14} strokeWidth={1.75} />
      <span>{label}</span>
      {badge ? <span className="tnum text-[11px] opacity-75">{badge}</span> : null}
    </button>
  );
}

function Panel({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto relative mt-2 w-[min(84vw,330px)] rounded-[var(--r-md)] border border-line bg-raised p-4 shadow-[var(--e3)]"
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
