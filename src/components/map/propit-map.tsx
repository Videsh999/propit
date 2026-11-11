"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Map, {
  Layer,
  Source,
  Marker,
  type MapRef,
  type MapLayerMouseEvent,
  NavigationControl,
} from "react-map-gl/maplibre";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import {
  basemapSources, buildRasterStyle, groundOnlyStyle, loadVectorStyle, type BasemapSource,
} from "@/lib/providers/basemap";
import { makePill, PILL_SPECS } from "@/lib/map/pill";
// Side effect: repoints MapLibre at a worker URL the server can serve.
import "@/lib/map/worker";
import { useDiscovery } from "@/store/discovery";
import { circleRing, haversineKm } from "@/lib/geo/distance";
import { formatPrice } from "@/lib/format";
import { boundsFromPoints } from "@/lib/geo/spatial";
import type { Bounds, LatLng, Locality, Poi } from "@/types";
import { HYDERABAD_MAX_BOUNDS, INITIAL_FIT, MAX_ZOOM, MIN_ZOOM } from "@/lib/map/viewport";
import { useOrr } from "@/lib/hooks/use-orr";
import { CLUSTER_MAX_ZOOM } from "@/lib/map/constants";
import { AnchorPin } from "./anchor-pin";
import { LocalityMarker } from "./locality-marker";
import { cn } from "@/lib/utils";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  price: number;
  bedrooms: number;
  type: string;
}

export interface MapLocalityCount {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  count: number;
  minPrice: number;
}

export interface MapProject {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  priceMin: number;
}

interface Props {
  points: MapPoint[];
  /**
   * Homes that match everything except the active radius. Drawn as quiet dots
   * so narrowing a search dims the surroundings rather than erasing them.
   */
  contextPoints?: MapPoint[];
  localityCounts?: MapLocalityCount[];
  projects?: MapProject[];
  localities: Pick<Locality, "slug" | "name" | "center" | "boundary" | "avgPriceSqft">[];
  pois?: Poi[];
  zone?: [number, number][] | null;
  className?: string;
  interactive?: boolean;
  onBoundsChange?: (b: Bounds, zoom: number) => void;
  compact?: boolean;
  scrollZoom?: boolean;
  initialCenter?: LatLng;
  localityScope?: Pick<Locality, "boundary">;
  followDiscoveryCamera?: boolean;
}

/**
 * WebGL support is a constant for the life of the page, so it is resolved once
 * and cached rather than re-derived per mount. The server assumes support so
 * markup matches on hydration.
 */
let webglSupport: boolean | null = null;
function hasWebGL(): boolean {
  if (webglSupport !== null) return webglSupport;
  if (typeof document === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    webglSupport = !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}
const subscribeNever = () => () => {};

/**
 * PropIT's own overlay sources. Everything else on the style belongs to the
 * basemap provider, which is how the tile watchdog tells real imagery from our
 * own GeoJSON — listing them once stops the two checks from drifting apart.
 */
const OWN_SOURCES = [
  "properties",
  "context",
  "localities",
  "zone",
  "radii",
  "pois",
  "draw",
  "draw-vertices",
  "orr",
  "projects",
];

export function PropitMap({
  points,
  contextPoints = [],
  localityCounts = [],
  projects = [],
  localities,
  pois = [],
  zone = null,
  className,
  interactive = true,
  onBoundsChange,
  compact = false,
  scrollZoom = !compact,
  initialCenter,
  localityScope,
  followDiscoveryCamera = true,
}: Props) {
  const localityPoints = useMemo(
    () => localityScope?.boundary.map(([lng, lat]) => ({ lng, lat })) ?? [],
    [localityScope],
  );
  const openingBounds = boundsFromPoints(localityPoints);
  const limitBounds = boundsFromPoints(localityPoints, 0.48);
  const mapRef = useRef<MapRef | null>(null);
  const [tileError, setTileError] = useState(false);
  const webglOk = useSyncExternalStore(subscribeNever, hasWebGL, () => true);
  const [reloadKey, setReloadKey] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  // Vertices of the shape being drawn, plus the rubber-band point under the cursor.
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [hint, setHint] = useState<[number, number] | null>(null);
  /** Anchor corner/centre of a circle or rectangle being dragged out. */
  const [dragStart, setDragStart] = useState<[number, number] | null>(null);
  const [zoom, setZoom] = useState(11);
  // Bumped on every camera move so label placement is recomputed against the
  // current projection.


  const orrGeoJson = useOrr();
  const {
    anchors,
    radius,
    layers,
    selectedPropertyId,
    hoveredPropertyId,
    selectedLocalitySlug,
    command,
    consumeCommand,
    select,
    hover,
    selectLocality,
    updateAnchor,
    drawMode,
    setDrawMode,
    polygon,
    setPolygon,
  } = useDiscovery();

  // ---- basemap -----------------------------------------------------------
  const sources = useMemo(() => basemapSources(), []);
  const [sourceIndex, setSourceIndex] = useState(0);
  const source: BasemapSource | undefined = sources[sourceIndex];

  // A raster style is pure derivation from the source, so it needs no effect
  // and is ready on the very first render.
  const rasterStyle = useMemo(
    () => (source?.kind === "raster" ? buildRasterStyle(source, "light") : null),
    [source],
  );
  const [vectorStyle, setVectorStyle] = useState<StyleSpecification | null>(null);
  const fallbackStyle = useMemo(() => groundOnlyStyle("light"), []);
  const style = rasterStyle ?? vectorStyle ?? fallbackStyle;

  /**
   * Resolve the current source into a style.
   *
   * Raster styles are built in memory and are ready immediately. A vector style
   * needs one fetch, which is given a hard timeout — a style request that hangs
   * leaves MapLibre loading forever and renders nothing at all, so we would
   * rather drop to the next provider than wait.
   */
  useEffect(() => {
    if (!source || source.kind !== "vector") return;
    let cancelled = false;

    const ac = new AbortController();
    const timer = window.setTimeout(() => ac.abort(), 8000);

    loadVectorStyle(source, "light", ac.signal)
      .then((next) => {
        if (!cancelled) setVectorStyle(next);
      })
      .catch(() => {
        if (cancelled) return;
        if (sourceIndex < sources.length - 1) {
          console.warn(`[map] ${source.name} style unavailable; trying ${sources[sourceIndex + 1].name}`);
          setSourceIndex((i) => i + 1);
        } else {
          setTileError(true);
        }
      })
      .finally(() => window.clearTimeout(timer));

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [source, sourceIndex, sources, reloadKey]);

  /**
   * Fail over when imagery does not arrive.
   *
   * A style can load cleanly and still paint nothing if its tiles are blocked,
   * so the watchdog watches for a real tile rather than for "loaded".
   */
  const tileSeen = useRef(false);

  /**
   * Ask the map directly whether the basemap has loaded any tiles.
   *
   * Listening for `sourcedata` events with a `tile` attached proved unreliable —
   * it reported Esri as tileless while Esri's imagery was on screen, and so
   * abandoned working providers. `isSourceLoaded` is the map's own answer.
   */
  const basemapHasTiles = useCallback(() => {
    if (tileSeen.current) return true;
    const map = mapRef.current?.getMap();
    const own = new Set(OWN_SOURCES);
    const ids = map ? Object.keys(map.getStyle()?.sources ?? {}).filter((id) => !own.has(id)) : [];
    return ids.some((id) => {
      try {
        return map!.isSourceLoaded(id);
      } catch {
        return false;
      }
    });
  }, []);

  useEffect(() => {
    tileSeen.current = false;
    if (!source) return;
    let timer = 0;

    const check = () => {
      // A backgrounded tab throttles rendering, so no tile *can* load. Absence
      // of tiles there says nothing about the provider — wait, don't fail over.
      if (document.visibilityState === "hidden") {
        timer = window.setTimeout(check, 2000);
        return;
      }
      if (basemapHasTiles()) {
        setTileError(false);
        return;
      }
      if (sourceIndex < sources.length - 1) {
        console.warn(`[map] no tiles from ${source.name}; trying ${sources[sourceIndex + 1].name}`);
        setSourceIndex((i) => i + 1);
      } else {
        setTileError(true);
      }
    };

    timer = window.setTimeout(check, 9000);
    return () => window.clearTimeout(timer);
  }, [source, sourceIndex, sources, reloadKey, basemapHasTiles]);

  /**
   * Keep the canvas matched to its container.
   *
   * The map lives inside panels that expand, collapse and switch between split
   * and full-screen. MapLibre only resizes on window resize, so a container
   * that changes size on its own leaves a stretched or clipped canvas.
   */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => mapRef.current?.getMap()?.resize());
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);

  // ---- price chip images -------------------------------------------------
  const registerImages = useCallback((map: MapLibreMap | undefined) => {
    if (!map?.getStyle()) return false;
    let added = 0;
    for (const [name, spec] of Object.entries(PILL_SPECS)) {
      if (map.hasImage(name)) {
        added++;
        continue;
      }
      try {
        const pill = makePill(spec);
        if (!pill) continue;
        map.addImage(name, pill.image as never, pill.options as never);
        added++;
      } catch (err) {
        // A chip that won't register must never take the map down with it.
        console.warn(`[map] price chip "${name}" unavailable`, err);
      }
    }
    return added === Object.keys(PILL_SPECS).length;
  }, []);

  /**
   * Initialise by polling for the map instance rather than waiting on `load`.
   *
   * MapLibre only emits `load` after completing a render frame, and browsers
   * throttle requestAnimationFrame in background tabs — so a map created while
   * the tab is hidden would never finish initialising. Polling with a timer is
   * unaffected by that throttling, so the chips register either way.
   */
  useEffect(() => {
    let cancelled = false;
    let tries = 0;

    const attempt = () => {
      if (cancelled) return;
      const map = mapRef.current?.getMap();
      if (map) {
        if (process.env.NODE_ENV === "development") {
          (window as unknown as { __propitMap?: unknown }).__propitMap = map;
        }
        if (registerImages(map)) {
          setReady(true);
          if (onBoundsChange) {
            const b = map.getBounds();
            onBoundsChange(
              { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() },
              map.getZoom(),
            );
          }
          return;
        }
      }
      if (++tries < 80) setTimeout(attempt, 80);
    };

    attempt();
    return () => {
      cancelled = true;
    };
  }, [registerImages, onBoundsChange]);

  // Repaint when the tab comes back — throttled frames leave the canvas stale.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const map = mapRef.current?.getMap();
      if (!map) return;
      map.resize();
      map.triggerRepaint();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // ---- imperative camera commands ---------------------------------------
  useEffect(() => {
    if (!followDiscoveryCamera || !command || !mapRef.current) return;
    const map = mapRef.current.getMap();
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (command.kind === "flyTo" && command.center) {
      const opts = {
        center: [command.center.lng, command.center.lat] as [number, number],
        zoom: command.zoom ?? map.getZoom(),
        offset: [command.offsetX ?? 0, 0] as [number, number],
        duration: reduce ? 0 : 900,
        essential: true,
      };
      if (reduce) map.jumpTo(opts);
      else map.flyTo(opts);
    } else if (command.kind === "fitBounds" && command.bounds) {
      const b = command.bounds;
      map.fitBounds(
        [
          [b.west, b.south],
          [b.east, b.north],
        ],
        { padding: compact ? 40 : 96, duration: reduce ? 0 : 900 },
      );
    }
    consumeCommand();
  }, [command, consumeCommand, compact, followDiscoveryCamera]);

  // ---- GeoJSON sources ---------------------------------------------------
  const propertyGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: points.map((p) => ({
        type: "Feature" as const,
        id: p.id,
        properties: {
          id: p.id,
          label: formatPrice(p.price),
          selected: p.id === selectedPropertyId,
          hovered: p.id === hoveredPropertyId,
        },
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
      })),
    }),
    [points, selectedPropertyId, hoveredPropertyId],
  );

  const contextGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: contextPoints.map((p) => ({
        type: "Feature" as const,
        id: p.id,
        properties: { id: p.id },
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
      })),
    }),
    [contextPoints],
  );

  // Below the cluster zoom the map shows named areas with their counts rather
  // than anonymous bubbles; above it, individual prices.
  const showAreas = zoom < CLUSTER_MAX_ZOOM && localityCounts.length > 0;


  /**
   * Screen-space label placement.
   *
   * Hyderabad's western corridor packs a dozen localities into a few kilometres,
   * so at city zoom their labels sit on top of one another. Busiest areas win,
   * anything that would collide is dropped, and dropped labels return as the
   * camera moves and the map has room for them.
   *
   * Computed from the live projection, so it runs on camera movement rather
   * than during render.
   */
  const [placedAreas, setPlacedAreas] = useState<(MapLocalityCount & { compact: boolean })[]>([]);

  const placeAreas = useCallback((areas: MapLocalityCount[], enabled: boolean) => {
    const map = mapRef.current?.getMap();
    if (!map || !enabled || areas.length === 0) {
      setPlacedAreas([]);
      return;
    }

    // Approximates the rendered pill: 12px Inter medium plus the count badge.
    const fullWidth = (name: string) => name.length * 6.6 + 52;
    // A count badge is genuinely smaller than a named pill, so it reserves a
    // smaller box — otherwise the fallback tier buys almost nothing.
    const COMPACT_WIDTH = 30;
    const COMPACT_HEIGHT = 22;
    const HEIGHT = 30;
    const GAP = 6;
    const COMPACT_GAP = 2;

    const boxes: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const { width, height } = map.getCanvas().getBoundingClientRect();

    const boxFor = (x: number, y: number, w: number, compact = false) => {
      const h = compact ? COMPACT_HEIGHT : HEIGHT;
      const g = compact ? COMPACT_GAP : GAP;
      return { x1: x - w / 2 - g, y1: y - h - g, x2: x + w / 2 + g, y2: y + g };
    };
    const collides = (b: ReturnType<typeof boxFor>) =>
      boxes.some((o) => !(b.x2 < o.x1 || b.x1 > o.x2 || b.y2 < o.y1 || b.y1 > o.y2));

    const projected: { area: MapLocalityCount; x: number; y: number }[] = [];
    for (const area of [...areas].sort((a, b) => b.count - a.count)) {
      try {
        const p = map.project([area.lng, area.lat]);
        if (p.x < -80 || p.y < -40 || p.x > width + 80 || p.y > height + 40) continue;
        projected.push({ area, x: p.x, y: p.y });
      } catch {
        /* off the projection entirely */
      }
    }

    const keep: (MapLocalityCount & { compact: boolean })[] = [];

    // First pass: named pills, busiest first.
    const spilled: typeof projected = [];
    for (const item of projected) {
      const box = boxFor(item.x, item.y, fullWidth(item.area.name));
      if (collides(box)) {
        spilled.push(item);
        continue;
      }
      boxes.push(box);
      keep.push({ ...item.area, compact: false });
    }

    // Second pass: anything that lost gets a count-only badge, which is narrow
    // enough to fit in the gaps. An area with homes in it is never invisible —
    // it just shows less until there is room for its name.
    for (const item of spilled) {
      const box = boxFor(item.x, item.y, COMPACT_WIDTH, true);
      if (collides(box)) continue;
      boxes.push(box);
      keep.push({ ...item.area, compact: true });
    }

    setPlacedAreas(keep);
  }, []);

  // Re-place whenever the data behind the labels changes. Deferred a frame so
  // the map has settled and this never runs synchronously during an effect.
  useEffect(() => {
    const raf = requestAnimationFrame(() => placeAreas(localityCounts, showAreas));
    return () => cancelAnimationFrame(raf);
  }, [localityCounts, showAreas, placeAreas]);

  const projectGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: projects.map((p) => ({
        type: "Feature" as const,
        properties: { id: p.id, slug: p.slug, name: p.name },
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
      })),
    }),
    [projects],
  );

  const localityGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: localities.map((l) => ({
        type: "Feature" as const,
        properties: {
          slug: l.slug,
          name: l.name,
          priceSqft: l.avgPriceSqft,
          selected: l.slug === selectedLocalitySlug,
        },
        geometry: { type: "Polygon" as const, coordinates: [l.boundary] },
      })),
    }),
    [localities, selectedLocalitySlug],
  );

  const zoneGeoJson = useMemo(
    () =>
      zone
        ? {
            type: "FeatureCollection" as const,
            features: [
              {
                type: "Feature" as const,
                properties: {},
                geometry: { type: "Polygon" as const, coordinates: [zone] },
              },
            ],
          }
        : { type: "FeatureCollection" as const, features: [] },
    [zone],
  );

  const radiusGeoJson = useMemo(() => {
    const rings: { center: { lat: number; lng: number }; km: number }[] = [];
    if (radius) rings.push({ center: radius.center, km: radius.km });
    for (const a of anchors) rings.push({ center: a.location, km: a.maxKm });
    return {
      type: "FeatureCollection" as const,
      features: rings.map((r, i) => ({
        type: "Feature" as const,
        properties: { i },
        geometry: { type: "Polygon" as const, coordinates: [circleRing(r.center, r.km)] },
      })),
    };
  }, [radius, anchors]);

  /**
   * The shape being dragged out, for circle and rectangle.
   *
   * Both are two-point gestures — press, drag, release — so they share one
   * anchor point and derive their ring from wherever the cursor currently is.
   * Polygon stays click-to-place, because a shape with an unknown number of
   * corners cannot be expressed as a drag.
   */
  const dragRing = useMemo((): [number, number][] | null => {
    if (!dragStart || !hint) return null;
    if (drawMode === "circle") {
      const km = haversineKm(
        { lng: dragStart[0], lat: dragStart[1] },
        { lng: hint[0], lat: hint[1] },
      );
      if (km < 0.05) return null;
      return circleRing({ lng: dragStart[0], lat: dragStart[1] }, km);
    }
    if (drawMode === "rectangle") {
      const [x1, y1] = dragStart;
      const [x2, y2] = hint;
      if (Math.abs(x2 - x1) < 1e-4 || Math.abs(y2 - y1) < 1e-4) return null;
      return [
        [x1, y1],
        [x2, y1],
        [x2, y2],
        [x1, y2],
        [x1, y1],
      ];
    }
    return null;
  }, [dragStart, hint, drawMode]);

  const drawGeoJson = useMemo(() => {
    const features: GeoJSON.Feature[] = [];

    if (dragRing) {
      features.push({
        type: "Feature",
        properties: { kind: "fill" },
        geometry: { type: "Polygon", coordinates: [dragRing] },
      });
      features.push({
        type: "Feature",
        properties: { kind: "line" },
        geometry: { type: "LineString", coordinates: dragRing },
      });
    }

    const live = hint && draft.length ? [...draft, hint] : draft;
    if (live.length >= 2) {
      features.push({
        type: "Feature",
        properties: { kind: "line" },
        geometry: { type: "LineString", coordinates: live },
      });
    }
    if (live.length >= 3) {
      features.push({
        type: "Feature",
        properties: { kind: "fill" },
        geometry: { type: "Polygon", coordinates: [[...live, live[0]]] },
      });
    }
    if (polygon) {
      features.push({
        type: "Feature",
        properties: { kind: "committed" },
        geometry: { type: "Polygon", coordinates: [polygon] },
      });
    }
    return { type: "FeatureCollection" as const, features };
  }, [draft, hint, polygon, dragRing]);

  const vertexGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: draft.map((c, i) => ({
        type: "Feature" as const,
        properties: { first: i === 0 },
        geometry: { type: "Point" as const, coordinates: c },
      })),
    }),
    [draft],
  );

  const activePoiCats = useMemo(
    () =>
      Object.entries(layers)
        .filter(([k, v]) => v && !["localities", "projects", "priceHeat"].includes(k))
        .map(([k]) => k),
    [layers],
  );

  const poiGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: pois
        .filter((p) => activePoiCats.includes(p.category))
        .map((p) => ({
          type: "Feature" as const,
          properties: { name: p.name, category: p.category },
          geometry: { type: "Point" as const, coordinates: [p.location.lng, p.location.lat] },
        })),
    }),
    [pois, activePoiCats],
  );

  // ---- interaction -------------------------------------------------------
  const finishDraw = useCallback(
    (points: [number, number][]) => {
      if (points.length < 3) return;
      const ring: [number, number][] = [...points, points[0]];
      setPolygon(ring);
      setDrawMode("none");
      setDraft([]);
      setHint(null);
    },
    [setPolygon, setDrawMode],
  );

  /** Commit a ring that is already closed — the circle and rectangle path. */
  const commitRing = useCallback(
    (ring: [number, number][]) => {
      setPolygon(ring);
      setDrawMode("none");
      setDragStart(null);
      setHint(null);
    },
    [setPolygon, setDrawMode],
  );

  // Escape cancels an in-progress shape; Enter closes it.
  useEffect(() => {
    if (drawMode === "none") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDraft([]);
        setHint(null);
        setDragStart(null);
        setDrawMode("none");
      } else if (e.key === "Enter") {
        finishDraw(draft);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawMode, draft, finishDraw, setDrawMode]);

  /**
   * Hand the drag to the drawing tool rather than the camera.
   *
   * Dragging is how you pan a map, so while a drag-to-draw tool is armed the
   * map's own pan has to stand down — otherwise the first stroke slides the
   * city out from under the shape. Restored the moment the tool is dismissed.
   */
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const dragToDraw = drawMode === "circle" || drawMode === "rectangle";
    if (dragToDraw) map.dragPan.disable();
    else map.dragPan.enable();
    // Capture the instance rather than re-reading the ref on cleanup: this must
    // re-enable panning on the map it disabled it on, not on whichever map the
    // ref happens to hold by then.
    return () => {
      map.dragPan.enable();
    };
  }, [drawMode, ready]);

  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => {
      if (drawMode === "polygon") {
        const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        // Clicking the first vertex again closes the shape.
        if (draft.length >= 3) {
          const first = draft[0];
          const px = mapRef.current?.getMap().project(first);
          if (px && Math.hypot(px.x - e.point.x, px.y - e.point.y) < 14) {
            finishDraw(draft);
            return;
          }
        }
        setDraft((d) => [...d, pt]);
        return;
      }

      const f = e.features?.[0];
      if (!f) return;
      if (f.layer.id === "property-pill" || f.layer.id === "property-dot") {
        select(f.properties?.id as string);
      } else if (f.layer.id === "project-dot") {
        const map = mapRef.current?.getMap();
        if (map) {
          map.easeTo({
            center: (f.geometry as GeoJSON.Point).coordinates as [number, number],
            zoom: Math.max(map.getZoom(), 14.5),
            duration: 700,
          });
        }
      } else if (f.layer.id === "locality-fill") {
        selectLocality(f.properties?.slug as string);
      }
    },
    [select, selectLocality, drawMode, draft, finishDraw],
  );

  const handleMove = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const nextZoom = map.getZoom();
    setZoom(nextZoom);
    placeAreas(localityCounts, nextZoom < CLUSTER_MAX_ZOOM && localityCounts.length > 0);
    if (!onBoundsChange) return;
    const b = map.getBounds();
    onBoundsChange(
      { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() },
      map.getZoom(),
    );
  }, [onBoundsChange, placeAreas, localityCounts]);

  const [cursor, setCursor] = useState("grab");

  return (
    <div ref={containerRef} className={cn("relative h-full w-full", className)}>
      <Map
        ref={mapRef}
        mapStyle={style}
        initialViewState={initialCenter
          ? { latitude: initialCenter.lat, longitude: initialCenter.lng, zoom: 15 }
          : openingBounds
            ? { bounds: [[openingBounds.west, openingBounds.south], [openingBounds.east, openingBounds.north]], fitBoundsOptions: { padding: 18 } }
            : INITIAL_FIT}
        maxBounds={limitBounds ? [limitBounds.west, limitBounds.south, limitBounds.east, limitBounds.north] : HYDERABAD_MAX_BOUNDS}
        onError={(e) => {
          if (process.env.NODE_ENV === "development") console.warn("[map]", e.error?.message);
        }}
        onSourceData={(e) => {
          // Proof that real imagery arrived — this is what cancels the failover.
          // Vector sources are named by the upstream style, so accept any tile
          // that is not one of PropIT's own overlays.
          const own = OWN_SOURCES;
          if (e.tile && e.sourceId && !own.includes(e.sourceId)) {
            tileSeen.current = true;
            setTileError(false);
          }
        }}
        onMoveEnd={handleMove}
        onClick={handleClick}
        onMouseDown={(e) => {
          if (drawMode !== "circle" && drawMode !== "rectangle") return;
          setDragStart([e.lngLat.lng, e.lngLat.lat]);
          setHint([e.lngLat.lng, e.lngLat.lat]);
        }}
        onMouseUp={() => {
          if (drawMode !== "circle" && drawMode !== "rectangle") return;
          // A click with no drag is an abandoned gesture, not an empty area.
          if (dragRing) commitRing(dragRing);
          else setDragStart(null);
        }}
        onMouseMove={(e) => {
          if (drawMode === "circle" || drawMode === "rectangle") {
            setCursor("crosshair");
            if (dragStart) setHint([e.lngLat.lng, e.lngLat.lat]);
            return;
          }
          if (drawMode === "polygon") {
            setHint([e.lngLat.lng, e.lngLat.lat]);
            setCursor("crosshair");
            return;
          }
          const f = e.features?.[0];
          if (f?.layer.id === "property-pill" || f?.layer.id === "property-dot") {
            hover(f.properties?.id as string);
            setCursor("pointer");
          } else if (f) {
            setCursor("pointer");
            hover(null);
          } else {
            setCursor("grab");
            hover(null);
          }
        }}
        interactive={interactive}
        interactiveLayerIds={[
          ...(ready ? ["property-pill"] : []),
          "property-dot",
          ...(layers.projects ? ["project-dot"] : []),
          ...(layers.localities ? ["locality-fill"] : []),
        ]}
        cursor={cursor}
        attributionControl={{ compact: true }}
        maxZoom={MAX_ZOOM}
        minZoom={MIN_ZOOM}
        scrollZoom={scrollZoom}
        dragRotate={false}
        touchPitch={false}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Locality boundaries */}
        {layers.localities && (
          <Source id="localities" type="geojson" data={localityGeoJson}>
            <Layer
              id="locality-fill"
              type="fill"
              maxzoom={13.5}
              paint={{
                "fill-color": [
                  "case",
                  ["get", "selected"],
                  "#285640",
                  layers.priceHeat ? ["interpolate", ["linear"], ["get", "priceSqft"], 4200, "#248A3D", 9000, "#C93400", 17500, "#D70015"] : "#285640",
                ],
                // The unselected wash existed to give an empty map some texture.
                // Now that real streets and water render underneath, it reads as
                // mud — so it is barely there until a locality is chosen.
                "fill-opacity": ["case", ["get", "selected"], 0.16, layers.priceHeat ? 0.3 : 0.025],
              }}
            />
            <Layer
              id="locality-line"
              type="line"
              maxzoom={14}
              paint={{
                "line-color": ["case", ["get", "selected"], "#285640", "#A89C82"],
                "line-width": ["case", ["get", "selected"], 2, 0.9],
                "line-opacity": ["case", ["get", "selected"], 0.9, 0.45],
              }}
            />
            <Layer
              id="locality-label"
              type="symbol"
              maxzoom={14}
              layout={{
                "text-field": ["get", "name"],
                "text-font": ["Open Sans Semibold"],
                "text-size": ["interpolate", ["linear"], ["zoom"], 9, 10, 13, 13],
                "text-letter-spacing": 0.06,
                "text-transform": "uppercase",
                "text-allow-overlap": false,
              }}
              paint={{
                "text-color": "#1D1D1F",
                "text-halo-color": "#F7F4EC",
                "text-halo-width": 1.8,
              }}
            />
          </Source>
        )}

        {/* The Outer Ring Road — Hyderabad's defining geographic anchor.
            Real OSM geometry, not an approximated circle. */}
        <Source id="orr" type="geojson" data={orrGeoJson}>
          <Layer
            id="orr-casing"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": "#F7F4EC",
              "line-width": ["interpolate", ["linear"], ["zoom"], 9, 4, 12, 7, 15, 12],
              "line-opacity": 0.9,
            }}
          />
          <Layer
            id="orr-line"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": "#285640",
              "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.6, 12, 2.6, 15, 4],
              "line-opacity": ["interpolate", ["linear"], ["zoom"], 9, 0.75, 13, 0.6],
            }}
          />
          <Layer
            id="orr-label"
            type="symbol"
            minzoom={10}
            layout={{
              "symbol-placement": "line",
              "symbol-spacing": 340,
              "text-field": "ORR",
              "text-font": ["Open Sans Semibold"],
              "text-size": 10,
              "text-letter-spacing": 0.14,
              "text-padding": 4,
            }}
            paint={{
              "text-color": "#285640",
              "text-halo-color": "#F7F4EC",
              "text-halo-width": 1.6,
            }}
          />
        </Source>

        {/* Livable zone */}
        <Source id="zone" type="geojson" data={zoneGeoJson}>
          <Layer id="zone-fill" type="fill" paint={{ "fill-color": "#285640", "fill-opacity": 0.12 }} />
          <Layer
            id="zone-line"
            type="line"
            paint={{
              "line-color": "#285640",
              "line-width": 1.6,
              "line-dasharray": [3, 2],
              "line-opacity": 0.75,
            }}
          />
        </Source>

        {/* Draw-area shapes */}
        <Source id="draw" type="geojson" data={drawGeoJson}>
          <Layer
            id="draw-fill"
            type="fill"
            filter={["!=", ["get", "kind"], "line"]}
            paint={{
              "fill-color": "#17150F",
              "fill-opacity": ["case", ["==", ["get", "kind"], "committed"], 0.06, 0.1],
            }}
          />
          <Layer
            id="draw-line"
            type="line"
            paint={{
              "line-color": "#17150F",
              "line-width": 1.6,
              "line-dasharray": ["case", ["==", ["get", "kind"], "committed"], ["literal", [1, 0]], ["literal", [3, 2]]],
            }}
          />
        </Source>
        <Source id="draw-vertices" type="geojson" data={vertexGeoJson}>
          <Layer
            id="draw-vertex"
            type="circle"
            paint={{
              "circle-radius": ["case", ["get", "first"], 6, 4],
              "circle-color": "#FBFAF7",
              "circle-stroke-color": "#17150F",
              "circle-stroke-width": 1.8,
            }}
          />
        </Source>

        {/* Anchor radii + explicit radius search */}
        <Source id="radii" type="geojson" data={radiusGeoJson}>
          <Layer id="radius-fill" type="fill" paint={{ "fill-color": "#B0763C", "fill-opacity": 0.05 }} />
          <Layer
            id="radius-line"
            type="line"
            paint={{ "line-color": "#B0763C", "line-width": 1.2, "line-opacity": 0.55, "line-dasharray": [2, 2] }}
          />
        </Source>

        {/* POI layers */}
        {activePoiCats.length > 0 && (
          <Source id="pois" type="geojson" data={poiGeoJson}>
            {/* A place, not a data point: a pale disc with a forest ring reads
                as somewhere you could go, and stays quiet enough that a screen
                full of them never competes with the prices. */}
            <Layer
              id="poi-dot"
              type="circle"
              paint={{
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 15, 6],
                "circle-color": "#FBFAF7",
                "circle-stroke-color": "#285640",
                "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 10, 1.2, 15, 1.8],
                "circle-stroke-opacity": 0.72,
              }}
            />
            <Layer
              id="poi-label"
              type="symbol"
              minzoom={12.5}
              layout={{
                "text-field": ["get", "name"],
                "text-font": ["Open Sans Regular"],
                "text-size": 11,
                "text-offset": [0, 1.1],
                "text-anchor": "top",
                "text-max-width": 9,
              }}
              paint={{ "text-color": "#4A453C", "text-halo-color": "#FBFAF7", "text-halo-width": 1.4 }}
            />
          </Source>
        )}

        {/* Projects — a distinct mark from an individual listing, since a
            project is a place you visit rather than a unit you buy. */}
        {layers.projects && (
          <Source id="projects" type="geojson" data={projectGeoJson}>
            <Layer
              id="project-dot"
              type="circle"
              paint={{
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4, 14, 7],
                "circle-color": "#C93400",
                "circle-stroke-color": "#F7F4EC",
                "circle-stroke-width": 2,
              }}
            />
            <Layer
              id="project-label"
              type="symbol"
              minzoom={12.5}
              layout={{
                "text-field": ["get", "name"],
                "text-font": ["Open Sans Semibold"],
                "text-size": 11,
                "text-offset": [0, 1.1],
                "text-anchor": "top",
                "text-max-width": 9,
              }}
              paint={{
                "text-color": "#285640",
                "text-halo-color": "#F7F4EC",
                "text-halo-width": 1.6,
              }}
            />
          </Source>
        )}

        {/* Homes just outside the radius. Present but receded — the ring reads
            as a decision the user made, not as the edge of the world. Drawn
            before the matches so a match always sits on top. */}
        {contextPoints.length > 0 && (
          <Source id="context" type="geojson" data={contextGeoJson}>
            <Layer
              id="context-dot"
              type="circle"
              layout={{ visibility: showAreas ? "none" : "visible" }}
              paint={{
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 2.4, 15, 3.6],
                "circle-color": "#8A7B5E",
                "circle-opacity": 0.28,
                "circle-stroke-color": "#F7F4EC",
                "circle-stroke-width": 0.8,
                "circle-stroke-opacity": 0.4,
              }}
            />
          </Source>
        )}

        {/* Properties.
            The dot layer needs no fonts and no generated images, so a home is
            always on the map even if the price chip cannot draw. The chip sits
            on top and covers it wherever it renders. */}
        <Source id="properties" type="geojson" data={propertyGeoJson}>
          <Layer
            id="property-dot"
            type="circle"
            layout={{ visibility: showAreas ? "none" : "visible" }}
            paint={{
              "circle-radius": ["case", ["get", "selected"], 6, ["get", "hovered"], 5.5, 4],
              "circle-color": ["case", ["get", "selected"], "#17150F", "#FFFFFF"],
              "circle-stroke-color": ["case", ["get", "selected"], "#17150F", "#8A7B5E"],
              "circle-stroke-width": 1.6,
              "circle-opacity": 1,
            }}
          />
          {ready && (
            <Layer
              id="property-pill"
              type="symbol"
              layout={{
                visibility: showAreas ? "none" : "visible",
                "icon-image": [
                  "case",
                  ["get", "selected"],
                  "pill-selected",
                  ["get", "hovered"],
                  "pill-hover",
                  "pill-idle",
                ],
                "icon-text-fit": "both",
                "icon-text-fit-padding": [2, 9, 2, 9],
                "icon-allow-overlap": false,
                "icon-optional": false,
                "text-field": ["get", "label"],
                "text-font": ["Open Sans Semibold"],
                "text-size": 12,
                "text-allow-overlap": false,
                "text-padding": 3,
                "symbol-sort-key": ["case", ["get", "selected"], 0, ["get", "hovered"], 1, 2],
              }}
              paint={{
                "text-color": ["case", ["get", "selected"], "#FBFAF7", "#17150F"],
              }}
            />
          )}
        </Source>

        {/* Named areas with live counts. Only ~40 ever exist, so these are DOM
            markers: better type, a hover reveal, and no reliance on map fonts. */}
        {placedAreas.map((l) => (
          <Marker key={l.slug} longitude={l.lng} latitude={l.lat} anchor="bottom">
            <LocalityMarker
              name={l.name}
              count={l.count}
              minPrice={l.minPrice}
              compact={l.compact}
              selected={selectedLocalitySlug === l.slug}
              dimmed={!!selectedLocalitySlug && selectedLocalitySlug !== l.slug}
              onClick={() => {
                selectLocality(l.slug);
                const map = mapRef.current?.getMap();
                map?.easeTo({ center: [l.lng, l.lat], zoom: 13.2, duration: 800 });
              }}
            />
          </Marker>
        ))}

        {/* Anchors — few, draggable, and worth real DOM */}
        {anchors.map((a) => (
          <Marker
            key={a.id}
            longitude={a.location.lng}
            latitude={a.location.lat}
            anchor="bottom"
            draggable
            onDragEnd={(e) =>
              updateAnchor(a.id, { location: { lat: e.lngLat.lat, lng: e.lngLat.lng } })
            }
          >
            <AnchorPin anchor={a} />
          </Marker>
        ))}

        {interactive && (
          <NavigationControl position="top-right" showCompass={false} visualizePitch={false} />
        )}
      </Map>

      {drawMode !== "none" && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-20 max-w-[90%] -translate-x-1/2 rounded-full border border-line bg-[color-mix(in_srgb,var(--paper-raised)_92%,transparent)] px-3.5 py-2 text-center text-[12px] text-muted shadow-[var(--e1)] backdrop-blur">
          {drawMode === "circle" &&
            (dragStart ? "Release to keep this circle." : "Press at the centre, then drag outward.")}
          {drawMode === "rectangle" &&
            (dragStart ? "Release to keep this rectangle." : "Press one corner, then drag to the other.")}
          {drawMode === "polygon" &&
            (draft.length < 3
              ? "Click to place corners — at least three."
              : "Click the first point, or press Enter, to close the area.")}
          <span className="ml-2 text-faint">Esc to cancel</span>
        </div>
      )}

      {!webglOk && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-sunk px-6 text-center">
          <div className="max-w-[36ch]">
            <p className="text-[15px] font-medium text-ink">This browser can&apos;t display the map.</p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              PropIT&apos;s map needs WebGL, which appears to be disabled or unsupported here. Search,
              filters and listings all still work.
            </p>
          </div>
        </div>
      )}

      {webglOk && tileError && (
        <div className="absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-line bg-[color-mix(in_srgb,var(--paper-raised)_94%,transparent)] py-1.5 pl-4 pr-1.5 shadow-[var(--e2)] backdrop-blur">
          <span className="text-[12px] text-ink">
            Map tiles couldn&apos;t load. Check your connection or network filter.
          </span>
          <button
            onClick={() => {
              setTileError(false);
              setSourceIndex(0);
              setReloadKey((k) => k + 1);
            }}
            className="rounded-full bg-accent px-3 py-1 text-[12px] font-medium text-[var(--accent-ink)] transition-colors hover:bg-accent-hover"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
