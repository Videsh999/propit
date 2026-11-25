"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Building2,
  Circle,
  Dumbbell,
  GraduationCap,
  Layers,
  MapPin,
  Pencil,
  Plane,
  Radius as RadiusIcon,
  RefreshCw,
  Square,
  ShoppingBag,
  SquareStack,
  Stethoscope,
  Trees,
  TramFront,
  Trophy,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { SearchInput } from "@/components/search/search-input";
import { useDiscovery, type DrawMode } from "@/store/discovery";
import { usePoiViewport } from "@/lib/hooks/use-poi-viewport";
import { useBoundsDrift } from "@/lib/hooks/use-bounds-drift";
import { POI_CATEGORY_LABEL } from "@/lib/data/pois";
import type { LatLng, Locality, PoiCategory } from "@/types";
import { haversineKm } from "@/lib/geo/distance";
import { cn } from "@/lib/utils";

type LocalityLite = Pick<Locality, "slug" | "name" | "center">;


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

type Panel = "radius" | "draw" | "nearby" | "layers" | null;

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
  const toggleLayer = useDiscovery((s) => s.toggleLayer);
  const anchors = useDiscovery((s) => s.anchors);
  const anchorsOpen = useDiscovery((s) => s.anchorsOpen);
  const setAnchorsOpen = useDiscovery((s) => s.setAnchorsOpen);
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
    <div ref={ref} className="pointer-events-none relative">
      <div className="glass-panel pointer-events-auto inline-flex max-w-full items-center gap-0.5 rounded-2xl border p-1.5" role="group" aria-label="Map tools">
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
          icon={MapPin}
          label="Anchors"
          active={anchorsOpen}
          badge={anchors.length || undefined}
          onClick={() => { setPanel(null); setAnchorsOpen(!anchorsOpen); }}
        />
        <Tool
          icon={Layers}
          label="Nearby"
          active={panel === "nearby" || activeNearby > 0}
          badge={activeNearby || undefined}
          onClick={() => toggle("nearby")}
        />
        <Tool
          icon={SquareStack}
          label="Layers"
          active={panel === "layers" || layers.priceHeat}
          onClick={() => toggle("layers")}
        />
      </div>

      <AnimatePresence>
        {!panel && drifted && (
          <motion.button
            key="search-area"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            onClick={commitBounds}
            className="pointer-events-auto absolute left-0 top-full mt-2 inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-3 text-[12px] font-semibold text-[var(--accent-ink)] shadow-[var(--e2)]"
          >
            <RefreshCw size={13} strokeWidth={2} />
            Search this area
          </motion.button>
        )}
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
        {panel === "layers" && (
          <Panel key="layers" onClose={() => setPanel(null)}>
            <p className="eyebrow mb-3">Map layers</p>
            <div className="grid gap-1.5">
              {([
                ["localities", "Locality boundaries"],
                ["projects", "Project locations"],
                ["priceHeat", "Locality price heatmap"],
              ] as const).map(([layer, label]) => (
                <label key={layer} className="flex min-h-9 items-center justify-between gap-2 rounded-lg border border-line px-3 text-[13px] text-ink">
                  {label}
                  <input
                    type="checkbox"
                    checked={layers[layer]}
                    onChange={() => {
                      if (layer === "priceHeat" && !layers.priceHeat && !layers.localities) toggleLayer("localities");
                      if (layer === "localities" && layers.localities && layers.priceHeat) toggleLayer("priceHeat");
                      toggleLayer(layer);
                    }}
                    className="size-4 accent-accent"
                  />
                </label>
              ))}
            </div>
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
  const radius = useDiscovery(state => state.radius);
  const pinning = useDiscovery(state => state.radiusPinning);
  const origin = useRadiusOrigin(localities);
  const [draft, setDraft] = useState<number | null>(null);
  const km = draft ?? radius?.km ?? 2;
  const distance = (value: number) => value < 1 ? `${Math.round(value * 1000)} m` : `${value} km`;
  function commit(next: number, center = origin?.center, label = origin?.label) {
    if (!center) return;
    const store = useDiscovery.getState(); store.setDrawMode("none"); store.setUseBounds(false); store.setPolygon(null); store.select(null); store.selectLocality(null); store.setFilters({ localitySlugs: [] });
    store.setRadius({ center, km: next, label: label ?? "Dropped pin" }); store.flyTo(center, next <= 1 ? 14.6 : next <= 3 ? 13.5 : next <= 5 ? 12.8 : 11.8);
  }
  return <div>
    <h3 className="mb-2 text-base font-semibold">Pin your starting point</h3>
    <SearchInput size="md" locationsOnly placeholder="Search Wipro Circle, a landmark…" onPickLocation={place => { useDiscovery.getState().setRadiusPinning(false); if (place.location) commit(km, place.location, place.label); }} />
    <button type="button" aria-pressed={pinning} onClick={() => useDiscovery.getState().setRadiusPinning(!pinning)} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-raised text-sm font-semibold text-accent"><MapPin size={16} />{pinning ? "Click on the map to place pin" : "Drop a pin on the map"}</button>
    <p className="mt-3 text-sm text-muted">From <strong className="text-ink">{radius?.label ?? origin?.label ?? "your chosen point"}</strong></p>
    <div className="mt-3 grid grid-cols-3 gap-2">{[.5, 1, 2, 3, 5, 10].map(value => <button key={value} type="button" aria-pressed={radius?.km === value} onClick={() => { setDraft(null); commit(value); }} className="min-h-10 rounded-xl border border-line bg-raised text-sm font-semibold text-accent aria-pressed:bg-accent aria-pressed:text-accent-ink">{distance(value)}</button>)}</div>
    <label className="mt-4 block text-xs text-muted">Radius in metres<input type="range" min={250} max={20000} step={250} value={km * 1000} aria-label="Search radius in metres" aria-valuetext={distance(km)} onChange={event => setDraft(Number(event.target.value) / 1000)} onPointerUp={() => { if (draft != null) commit(draft); setDraft(null); }} onKeyUp={() => { if (draft != null) commit(draft); setDraft(null); }} className="propit-range mt-2 w-full" /></label>
    <p className="mt-2 text-right text-sm font-semibold text-accent">{distance(km)}</p>
    <p className="mt-2 text-xs leading-relaxed text-muted">Drag the centre pin to move your search. Distance is measured in a straight line.</p>
    {radius && <button type="button" onClick={() => { useDiscovery.getState().setRadius(null); useDiscovery.getState().setRadiusPinning(false); setDraft(null); }} className="mt-3 min-h-9 text-sm font-semibold text-accent">Clear radius</button>}
  </div>;
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
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg px-2 text-[12px] font-medium transition-colors duration-[160ms] sm:px-2.5",
        active
          ? "bg-accent text-[var(--accent-ink)]"
          : "text-muted hover:bg-sunk hover:text-ink",
      )}
    >
      <Icon size={14} strokeWidth={1.75} />
      <span className="hidden min-[480px]:inline">{label}</span>
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
      className="pointer-events-auto absolute left-0 top-full mt-2 max-h-[min(50svh,420px)] w-[min(84vw,330px)] overflow-y-auto rounded-[var(--r-md)] border border-line bg-raised p-4 shadow-[var(--e3)]"
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
