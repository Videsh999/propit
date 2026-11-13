import "server-only";
import type {
  Anchor,
  Bounds,
  DataQuality,
  LatLng,
  Locality,
  NearbyPlace,
  Poi,
  PoiCategory,
  Project,
  ProjectStatus,
  Property,
  PropertyFilters,
  Relaxation,
  ScoredProperty,
} from "@/types";
import type { Cluster as SpatialCluster } from "@/lib/geo/spatial";
import { getStore, cellsForBounds, cellsForRadius } from "./store";
import {
  boundsContains,
  haversineKm,
  pointInRing,
  clusterPoints,
  intersectCircles,
  ringCentroid,
  ringAreaKm2,
  boundsFromPoints,
} from "@/lib/geo/spatial";
import { estimateLeg, getRoutingProvider } from "@/lib/providers/routing";
import { scoreProperty } from "@/lib/scoring/fit";
import { DEFAULT_FILTERS } from "./filters";
import { POI_CATEGORY_LABEL } from "./pois";

export interface QueryOptions {
  filters?: Partial<PropertyFilters>;
  bounds?: Bounds | null;
  center?: LatLng | null;
  radiusKm?: number | null;
  polygon?: [number, number][] | null;
  anchors?: Anchor[];
  sort?: "relevance" | "price_asc" | "price_desc" | "newest" | "area_desc" | "fit";
  limit?: number;
  offset?: number;
}

export interface LocalityCount {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  count: number;
  avgPriceSqft: number;
  minPrice: number;
  /** Year-on-year price movement, modelled from listed inventory. */
  momentumPct: number;
}

export interface MapPointDto {
  id: string;
  lat: number;
  lng: number;
  price: number;
  bedrooms: number;
  type: string;
}

export interface QueryResult {
  total: number;
  items: ScoredProperty[];
  clusters: SpatialCluster[];
  /** Every matching property reduced to a map-renderable point. */
  points: MapPointDto[];
  /**
   * Homes just outside an active radius that match on everything else.
   *
   * Drawn faded rather than removed, so narrowing a search never blanks the
   * map and the user keeps their bearings. Empty when no radius is set.
   */
  contextPoints: MapPointDto[];
  /**
   * How many matches sit in each named locality.
   *
   * At city zoom this is what the map shows instead of anonymous cluster
   * bubbles — "Kokapet 42" tells you something; "42" on its own does not.
   */
  localityCounts: LocalityCount[];
}

function mergeFilters(partial?: Partial<PropertyFilters>): PropertyFilters {
  return { ...DEFAULT_FILTERS, ...(partial ?? {}) };
}

/**
 * How far past the radius to keep scanning.
 *
 * A radius search that simply deletes everything outside the ring leaves the
 * user with no sense of what they excluded — the map goes quiet and they lose
 * their bearings. So we scan a wider box and hand back the surrounding homes
 * separately, for the map to draw faded. 1.9× is about a screen's worth of
 * context at every radius the UI offers.
 */
const RADIUS_CONTEXT_FACTOR = 1.9;

/** Candidate narrowing via the grid index — the equivalent of a GiST scan. */
function candidates(opts: QueryOptions): Property[] {
  const store = getStore();

  if (opts.center && opts.radiusKm) {
    const keys = cellsForRadius(opts.center, opts.radiusKm * RADIUS_CONTEXT_FACTOR);
    const out: Property[] = [];
    for (const k of keys) {
      const bucket = store.propertyGrid.get(k);
      if (bucket) out.push(...bucket);
    }
    return out;
  }

  if (opts.bounds) {
    const keys = cellsForBounds(opts.bounds);
    // Beyond a certain span the grid scan costs more than a linear pass.
    if (keys.length > 4000) return store.properties;
    const out: Property[] = [];
    for (const k of keys) {
      const bucket = store.propertyGrid.get(k);
      if (bucket) out.push(...bucket);
    }
    return out;
  }

  return store.properties;
}

function passesFilters(p: Property, f: PropertyFilters, store = getStore()): boolean {
  if (p.listingType !== f.listingType) return false;
  if (f.propertyTypes.length && !f.propertyTypes.includes(p.propertyType)) return false;
  if (f.bedrooms.length && !f.bedrooms.includes(p.bedrooms)) return false;

  const price = f.listingType === "rent" ? (p.rentMonthly ?? p.price) : p.price;
  if (f.priceMin != null && price < f.priceMin) return false;
  if (f.priceMax != null && price > f.priceMax) return false;

  if (f.areaMin != null && p.builtupAreaSqft < f.areaMin) return false;
  if (f.areaMax != null && p.builtupAreaSqft > f.areaMax) return false;
  if (f.possession.length && !f.possession.includes(p.possession)) return false;
  if (f.amenities.length && !f.amenities.every((a) => p.amenities.includes(a))) return false;
  if (f.verifiedOnly && !p.isVerified) return false;

  if (f.localitySlugs.length) {
    const loc = store.localityById.get(p.localityId);
    if (!loc || !f.localitySlugs.includes(loc.slug)) return false;
  }
  return true;
}

const MAX_HYDRATED = 300;
/** Enough surrounding context to keep the map legible, not enough to tax it. */
const MAX_CONTEXT_POINTS = 600;

export function queryProperties(opts: QueryOptions = {}): QueryResult {
  const store = getStore();
  const filters = mergeFilters(opts.filters);
  const anchors = opts.anchors ?? [];
  const limit = opts.limit ?? 40;
  const offset = opts.offset ?? 0;

  let matched: Property[] = [];
  /** Passes every other filter but falls outside the radius — drawn faded. */
  const surrounding: { p: Property; km: number }[] = [];

  for (const p of candidates(opts)) {
    if (opts.bounds && !boundsContains(opts.bounds, p.location)) continue;
    if (opts.polygon && !pointInRing(p.location, opts.polygon)) continue;
    if (!passesFilters(p, filters, store)) continue;
    if (opts.center && opts.radiusKm) {
      const km = haversineKm(opts.center, p.location);
      if (km > opts.radiusKm) {
        surrounding.push({ p, km });
        continue;
      }
    }
    matched.push(p);
  }

  // Anchor constraints are hard limits — this is the Livable Zone rule. They
  // bind the faded context too: those dots mean "matches everything except the
  // radius", so a home that also fails an anchor has no business being there.
  if (anchors.length) {
    const withinAnchors = (p: Property) =>
      anchors.every((a) => haversineKm(p.location, a.location) <= a.maxKm);
    matched = matched.filter(withinAnchors);
    for (let i = surrounding.length - 1; i >= 0; i--) {
      if (!withinAnchors(surrounding[i].p)) surrounding.splice(i, 1);
    }
  }

  const total = matched.length;

  const toPoint = (p: Property) => ({
    id: p.id,
    lat: p.location.lat,
    lng: p.location.lng,
    price: filters.listingType === "rent" ? (p.rentMonthly ?? p.price) : p.price,
    bedrooms: p.bedrooms,
    type: p.propertyType,
  });

  const points = matched.slice(0, 4000).map(toPoint);

  // Nearest first, so the context that survives the cap is the context that
  // sits just over the line — the homes a user might widen the ring to reach.
  surrounding.sort((a, b) => a.km - b.km);
  const contextPoints = surrounding.slice(0, MAX_CONTEXT_POINTS).map(({ p }) => toPoint(p));

  const scored: ScoredProperty[] = matched.map((p) => {
    const s = scoreProperty(p, anchors, filters);
    return {
      ...p,
      fitScore: s.fitScore,
      fitBreakdown: s.breakdown,
      budgetFit: s.budgetFit,
      typeMatch: s.typeMatch,
    };
  });

  const sort = opts.sort ?? (anchors.length ? "fit" : "relevance");
  scored.sort((a, b) => {
    switch (sort) {
      case "price_asc":
        return a.price - b.price;
      case "price_desc":
        return b.price - a.price;
      case "area_desc":
        return b.builtupAreaSqft - a.builtupAreaSqft;
      case "newest":
        return b.createdAt.localeCompare(a.createdAt);
      case "fit":
        return b.fitScore - a.fitScore;
      default:
        return (
          b.fitScore - a.fitScore ||
          Number(b.isVerified) - Number(a.isVerified) ||
          b.viewCount - a.viewCount
        );
    }
  });

  const byLocality = new Map<string, { count: number; minPrice: number }>();
  for (const p of matched) {
    const cur = byLocality.get(p.localityId);
    const price = filters.listingType === "rent" ? (p.rentMonthly ?? p.price) : p.price;
    if (cur) {
      cur.count++;
      cur.minPrice = Math.min(cur.minPrice, price);
    } else {
      byLocality.set(p.localityId, { count: 1, minPrice: price });
    }
  }

  const localityCounts: LocalityCount[] = [];
  for (const [id, agg] of byLocality) {
    const l = store.localityById.get(id);
    if (!l) continue;
    localityCounts.push({
      slug: l.slug,
      name: l.name,
      lat: l.center.lat,
      lng: l.center.lng,
      count: agg.count,
      avgPriceSqft: l.avgPriceSqft,
      minPrice: agg.minPrice,
      momentumPct: l.momentumPct,
    });
  }
  localityCounts.sort((a, b) => b.count - a.count);

  return {
    total,
    items: scored.slice(offset, offset + limit),
    clusters: [],
    points: points.slice(0, MAX_HYDRATED * 12),
    contextPoints,
    localityCounts,
  };
}

/**
 * Zoom at which individual prices replace cluster bubbles.
 *
 * Prices are the point of the map, so we show them as early as they can be read
 * without colliding. Above this, clustering only hides information.
 * Re-exported from the shared constant so client and server cannot drift.
 */
export { CLUSTER_MAX_ZOOM } from "@/lib/map/constants";
import { CLUSTER_MAX_ZOOM } from "@/lib/map/constants";

/** Server-side clustering so the browser never exceeds its feature budget. */
export function clusterFor(
  points: { id: string; lat: number; lng: number; price: number }[],
  zoom: number,
): SpatialCluster[] {
  if (zoom >= CLUSTER_MAX_ZOOM || points.length <= MAX_HYDRATED) return [];
  return clusterPoints(
    points.map((p) => ({ id: p.id, location: { lat: p.lat, lng: p.lng }, price: p.price })),
    zoom,
  );
}

// ---------------------------------------------------------------------------
// Livable Zone
// ---------------------------------------------------------------------------

export interface ZoneResult {
  zone: [number, number][] | null;
  areaKm2: number;
  center: LatLng | null;
  bounds: Bounds | null;
  total: number;
  items: ScoredProperty[];
  localityBreakdown: {
    slug: string;
    name: string;
    count: number;
    avgPriceSqft: number;
    medianPrice: number;
  }[];
  relaxations: Relaxation[];
  routingIsEstimate: boolean;
}

export function computeZone(
  anchors: Anchor[],
  filtersPartial?: Partial<PropertyFilters>,
  limit = 40,
): ZoneResult {
  const store = getStore();
  const filters = mergeFilters(filtersPartial);
  const routing = getRoutingProvider();

  const zone =
    anchors.length > 0
      ? intersectCircles(anchors.map((a) => ({ center: a.location, radiusKm: a.maxKm })))
      : null;

  const result = queryProperties({ filters, anchors, limit });

  const byLocality = new Map<string, number>();
  for (const p of store.properties) {
    if (!passesFilters(p, filters, store)) continue;
    if (!anchors.every((a) => haversineKm(p.location, a.location) <= a.maxKm)) continue;
    byLocality.set(p.localityId, (byLocality.get(p.localityId) ?? 0) + 1);
  }

  const localityBreakdown = [...byLocality.entries()]
    .map(([id, count]) => {
      const l = store.localityById.get(id)!;
      return {
        slug: l.slug,
        name: l.name,
        count,
        avgPriceSqft: l.avgPriceSqft,
        medianPrice: l.medianPrice,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    zone,
    areaKm2: zone ? Math.round(ringAreaKm2(zone) * 10) / 10 : 0,
    center: zone ? ringCentroid(zone) : null,
    bounds: zone ? boundsFromPoints(zone.map(([lng, lat]) => ({ lat, lng }))) : null,
    total: result.total,
    items: result.items,
    localityBreakdown,
    relaxations: result.total === 0 ? computeRelaxations(anchors, filters) : [],
    routingIsEstimate: routing.isEstimate,
  };
}

/**
 * Zero results is never an empty state. Find the single smallest change that
 * unlocks the most inventory and offer exactly that.
 */
export function computeRelaxations(
  anchors: Anchor[],
  filters: PropertyFilters,
): Relaxation[] {
  const out: Relaxation[] = [];

  const count = (a: Anchor[], f: PropertyFilters) =>
    queryProperties({ filters: f, anchors: a, limit: 0 }).total;

  // 1. Stretch each anchor in turn.
  for (const a of anchors) {
    for (const mult of [1.4, 1.8, 2.4, 3.2, 4.5]) {
      const nextKm = Math.round(a.maxKm * mult * 10) / 10;
      if (nextKm > 60) break;
      const relaxed = anchors.map((x) => (x.id === a.id ? { ...x, maxKm: nextKm } : x));
      const n = count(relaxed, filters);
      if (n > 0) {
        out.push({
          kind: "anchor",
          targetId: a.id,
          label: `Stretch ${a.label} to ${nextKm} km`,
          message: `Widening ${a.label} from ${a.maxKm} km to ${nextKm} km opens up ${n} ${
            n === 1 ? "home" : "homes"
          }.`,
          unlocked: n,
          patch: { anchorId: a.id, maxKm: nextKm },
        });
        break;
      }
    }
  }

  // 2. Lift the budget ceiling.
  if (filters.priceMax != null) {
    for (const mult of [1.15, 1.3, 1.6, 2, 2.6]) {
      const nextMax = Math.round((filters.priceMax * mult) / 100000) * 100000;
      const n = count(anchors, { ...filters, priceMax: nextMax });
      if (n > 0) {
        out.push({
          kind: "budget",
          targetId: null,
          label: `Raise budget to ${formatCrore(nextMax)}`,
          message: `Lifting your ceiling to ${formatCrore(nextMax)} brings ${n} ${
            n === 1 ? "home" : "homes"
          } into range.`,
          unlocked: n,
          patch: { priceMax: nextMax },
        });
        break;
      }
    }
  }

  // 3. Relax the bedroom requirement.
  if (filters.bedrooms.length) {
    const widened = [...new Set(filters.bedrooms.flatMap((b) => [b - 1, b, b + 1]))].filter(
      (b) => b >= 0 && b <= 5,
    );
    const n = count(anchors, { ...filters, bedrooms: widened });
    if (n > 0) {
      out.push({
        kind: "bedrooms",
        targetId: null,
        label: "Include nearby configurations",
        message: `Allowing one bedroom either side finds ${n} ${n === 1 ? "home" : "homes"}.`,
        unlocked: n,
        patch: { bedrooms: widened },
      });
    }
  }

  // 4. Open up the property type.
  if (filters.propertyTypes.length) {
    const n = count(anchors, { ...filters, propertyTypes: [] });
    if (n > 0) {
      out.push({
        kind: "type",
        targetId: null,
        label: "Show all property types",
        message: `Dropping the property-type filter finds ${n} ${n === 1 ? "home" : "homes"}.`,
        unlocked: n,
        patch: { propertyTypes: [] },
      });
    }
  }

  // 5. Last resort: no single change is enough, so loosen several at once,
  // giving up the most specific constraints first. An empty state is never an
  // acceptable answer — if any inventory exists, we owe the user a route to it.
  if (out.length === 0) {
    const steps: {
      distMult: number;
      budgetMult: number;
      dropType: boolean;
      widenBeds: boolean;
      dropBeds: boolean;
      describe: string;
    }[] = [
      { distMult: 1.8, budgetMult: 1.3, dropType: false, widenBeds: false, dropBeds: false, describe: "widening every distance and raising the budget" },
      { distMult: 2.5, budgetMult: 1.6, dropType: false, widenBeds: true, dropBeds: false, describe: "widening distances, raising the budget and allowing nearby sizes" },
      { distMult: 3.5, budgetMult: 2.2, dropType: true, widenBeds: true, dropBeds: false, describe: "widening distances, raising the budget and opening up property types" },
      { distMult: 6, budgetMult: 3.5, dropType: true, widenBeds: false, dropBeds: true, describe: "relaxing distance, budget, type and size together" },
    ];

    for (const step of steps) {
      const relaxedAnchors = anchors.map((a) => ({
        ...a,
        maxKm: Math.min(60, Math.round(a.maxKm * step.distMult * 10) / 10),
      }));
      const bedrooms = step.dropBeds
        ? []
        : step.widenBeds && filters.bedrooms.length
          ? [...new Set(filters.bedrooms.flatMap((b) => [b - 1, b, b + 1]))].filter((b) => b >= 0 && b <= 5)
          : filters.bedrooms;
      const relaxedFilters: PropertyFilters = {
        ...filters,
        bedrooms,
        propertyTypes: step.dropType ? [] : filters.propertyTypes,
        priceMax:
          filters.priceMax != null
            ? Math.round((filters.priceMax * step.budgetMult) / 100000) * 100000
            : null,
      };
      const n = count(relaxedAnchors, relaxedFilters);
      if (n === 0) continue;

      out.push({
        kind: "anchor",
        targetId: null,
        label: "Relax several constraints",
        message: `No single change is enough here — but ${step.describe} finds ${n} ${
          n === 1 ? "home" : "homes"
        }.`,
        unlocked: n,
        patch: {
          anchorMultiplier: step.distMult,
          ...(relaxedFilters.priceMax != null ? { priceMax: relaxedFilters.priceMax } : {}),
          ...(step.dropType ? { propertyTypes: [] } : {}),
          bedrooms,
        },
      });
      break;
    }
  }

  // 6. Absolute floor: if even that failed, offer the anchors on their own.
  if (out.length === 0 && anchors.length > 0) {
    const n = count(anchors, { ...DEFAULT_FILTERS, listingType: filters.listingType });
    if (n > 0) {
      out.push({
        kind: "type",
        targetId: null,
        label: "Clear all filters",
        message: `Nothing here matches those requirements. Keeping only your anchors leaves ${n} ${
          n === 1 ? "home" : "homes"
        } to look through.`,
        unlocked: n,
        patch: { bedrooms: [], propertyTypes: [], priceMax: null, priceMin: null, amenities: [] },
      });
    }
  }

  return out.sort((a, b) => b.unlocked - a.unlocked).slice(0, 4);
}

function formatCrore(n: number): string {
  return n >= 10000000 ? `₹${(n / 10000000).toFixed(2)} Cr` : `₹${Math.round(n / 100000)} L`;
}

// ---------------------------------------------------------------------------
// Nearby / locality intelligence
// ---------------------------------------------------------------------------

export function nearbyPlaces(
  center: LatLng,
  categories: PoiCategory[] | null,
  radiusKm = 6,
  perCategory = 3,
  { verifiedOnly = false }: { verifiedOnly?: boolean } = {},
): NearbyPlace[] {
  const store = getStore();
  const keys = cellsForRadius(center, radiusKm);
  const seen = new Set<string>();
  const found: NearbyPlace[] = [];

  for (const k of keys) {
    const bucket = store.poiGrid.get(k);
    if (!bucket) continue;
    for (const poi of bucket) {
      if (seen.has(poi.id)) continue;
      if (verifiedOnly && !poi.verified) continue;
      if (categories && categories.length && !categories.includes(poi.category)) continue;
      const d = haversineKm(center, poi.location);
      if (d > radiusKm) continue;
      seen.add(poi.id);
      const leg = estimateLeg(center, poi.location);
      found.push({ ...poi, distanceKm: Math.round(d * 100) / 100, minutes: leg.minutes, estimated: leg.estimated });
    }
  }

  // The airport is always relevant even when it falls outside the radius.
  const airport = store.pois.find((p) => p.category === "airport");
  if (airport && (!verifiedOnly || airport.verified) && !seen.has(airport.id) && (!categories || categories.includes("airport"))) {
    const d = haversineKm(center, airport.location);
    const leg = estimateLeg(center, airport.location);
    found.push({ ...airport, distanceKm: Math.round(d * 100) / 100, minutes: leg.minutes, estimated: leg.estimated });
  }

  found.sort((a, b) => a.distanceKm - b.distanceKm);

  const perCat = new Map<string, number>();
  return found.filter((p) => {
    const n = perCat.get(p.category) ?? 0;
    if (n >= perCategory) return false;
    perCat.set(p.category, n + 1);
    return true;
  });
}

/**
 * Projects for the homepage showcase.
 *
 * Curated, not sliced. Taking the first N verified projects returned four
 * Kokapet towers in a row and — because hero imagery is drawn from a pool by
 * seed — the same photograph on two adjacent cards. Every record was real and
 * the section still read as broken.
 *
 * So: one project per locality, never the same image twice, launches and
 * building sites ahead of finished stock, because that is what the section
 * claims to be showing. Where distinct localities run out the rule relaxes, but
 * the image rule never does — a repeated photograph is the louder failure.
 */
export function featuredProjects(limit = 6): Project[] {
  const store = getStore();

  const rank: Record<ProjectStatus, number> = {
    new_launch: 0,
    under_construction: 1,
    upcoming: 2,
    ready: 3,
  };

  const eligible = store.projects
    .filter((p) => p.reraVerified && p.dataQuality === "verified")
    .sort((a, b) => rank[a.status] - rank[b.status] || b.priceMax - a.priceMax);

  const out: Project[] = [];
  const picked = new Set<string>();
  const seenLocality = new Set<string>();
  const seenImage = new Set<string>();

  const take = (p: Project) => {
    picked.add(p.id);
    seenLocality.add(p.localityId);
    seenImage.add(p.heroImage);
    out.push(p);
  };

  for (const p of eligible) {
    if (out.length === limit) break;
    if (seenLocality.has(p.localityId) || seenImage.has(p.heroImage)) continue;
    take(p);
  }

  for (const p of eligible) {
    if (out.length === limit) break;
    if (picked.has(p.id) || seenImage.has(p.heroImage)) continue;
    take(p);
  }

  return out;
}

export interface CorridorReachDto {
  slug: string;
  name: string;
  blurb: string;
  center: LatLng;
  nearest: { category: PoiCategory; label: string; name: string; km: number }[];
}

/**
 * What each corridor actually reaches.
 *
 * Straight-line distance from the locality centre to the nearest catalogued
 * place of each kind. Deliberately not travel time: without a routing provider
 * a minutes figure would be distance multiplied by a guess, and presenting that
 * as a commute is the exact kind of confident-sounding number this product
 * refuses to invent. Every consumer labels these as distances.
 */
export function corridorReach(
  slugs: string[],
  categories: PoiCategory[],
): CorridorReachDto[] {
  const store = getStore();
  const out: CorridorReachDto[] = [];

  for (const slug of slugs) {
    const loc = store.localityBySlug.get(slug);
    if (!loc) continue;

    const nearest: CorridorReachDto["nearest"] = [];
    for (const category of categories) {
      let best: { poi: Poi; km: number } | null = null;
      for (const poi of store.pois) {
        if (poi.category !== category) continue;
        const km = haversineKm(loc.center, poi.location);
        // A corridor is often itself a catalogued place — Financial District is
        // an office hub — and "Office hubs: 0 m, Financial District" is a true
        // statement that reads as a bug. Answer with the nearest *other* one.
        if (km < 0.2) continue;
        if (!best || km < best.km) best = { poi, km };
      }
      if (!best) continue;
      nearest.push({
        category,
        label: POI_CATEGORY_LABEL[category],
        // Generated neighbourhood POIs are named "Thing, Locality"; the
        // locality half is redundant next to a distance from that locality.
        name: best.poi.name.split(",")[0].trim(),
        km: Math.round(best.km * 10) / 10,
      });
    }

    out.push({
      slug: loc.slug,
      name: loc.name,
      blurb: loc.summary,
      center: loc.center,
      nearest,
    });
  }

  return out;
}

export interface PoiViewport {
  /** How many places of each category sit inside the box. */
  counts: Partial<Record<PoiCategory, number>>;
  /** The places themselves, for the categories the user has switched on. */
  places: Poi[];
}

/**
 * POIs for what is currently on screen.
 *
 * The Nearby panel shows a count beside every category, and those counts have
 * to agree with what the map is drawing — a panel claiming ten schools beside a
 * map showing three reads as broken. So both come from one query over the same
 * box. Counts are cheap enough to compute for every category; the places
 * themselves are only returned for categories that are switched on, which keeps
 * the response small while the panel stays fully populated.
 */
export function poisInBounds(
  bounds: Bounds,
  active: PoiCategory[] = [],
  limitPerCategory = 120,
): PoiViewport {
  const store = getStore();
  const counts: Partial<Record<PoiCategory, number>> = {};
  const places: Poi[] = [];
  const wanted = new Set(active);
  const taken = new Map<PoiCategory, number>();

  const keys = cellsForBounds(bounds);
  // A box spanning the whole city touches more cells than there are POIs, so
  // past that point the linear pass is the cheaper scan.
  const scan =
    keys.length > store.pois.length
      ? store.pois
      : keys.flatMap((k) => store.poiGrid.get(k) ?? []);

  const seen = new Set<string>();
  for (const poi of scan) {
    if (seen.has(poi.id)) continue;
    if (!boundsContains(bounds, poi.location)) continue;
    seen.add(poi.id);
    counts[poi.category] = (counts[poi.category] ?? 0) + 1;
    if (!wanted.has(poi.category)) continue;
    const n = taken.get(poi.category) ?? 0;
    if (n >= limitPerCategory) continue;
    taken.set(poi.category, n + 1);
    places.push(poi);
  }

  return { counts, places };
}

export interface LocalityIntelligence {
  locality: Locality;
  stats: {
    avgPriceSqft: number;
    medianPrice: number;
    inventory: number;
    projects: number;
    rentalYieldPct: number;
    momentumPct: number;
    avgRent: number;
    priceRange: { min: number; max: number };
  };
  priceHistory: { year: number; priceSqft: number }[];
  nearby: NearbyPlace[];
  topProjects: Project[];
  featured: Property[];
  connectivity: NearbyPlace[];
}

export function localityIntelligence(slug: string): LocalityIntelligence | null {
  const store = getStore();
  const locality = store.localityBySlug.get(slug);
  if (!locality) return null;

  const props = store.propertiesByLocality.get(locality.id) ?? [];
  const buys = props.filter((p) => p.listingType === "buy");
  const rents = props.filter((p) => p.listingType === "rent" && p.rentMonthly);

  const prices = buys.map((p) => p.price).sort((a, b) => a - b);
  const avgRent = rents.length
    ? Math.round(rents.reduce((s, p) => s + (p.rentMonthly ?? 0), 0) / rents.length)
    : 0;

  const projects = store.projects.filter((p) => p.localityId === locality.id);

  return {
    locality,
    stats: {
      avgPriceSqft: locality.avgPriceSqft,
      medianPrice: prices.length ? prices[Math.floor(prices.length / 2)] : 0,
      inventory: props.length,
      projects: projects.length,
      rentalYieldPct: locality.rentalYieldPct,
      momentumPct: locality.momentumPct,
      avgRent,
      priceRange: {
        min: prices[0] ?? 0,
        max: prices[prices.length - 1] ?? 0,
      },
    },
    priceHistory: locality.priceHistory,
    nearby: nearbyPlaces(locality.center, null, 7, 3),
    connectivity: nearbyPlaces(
      locality.center,
      ["metro", "railway", "airport", "office_hub"],
      40,
      2,
    ),
    topProjects: projects.slice(0, 6),
    featured: buys
      .slice()
      .sort((a, b) => Number(b.isVerified) - Number(a.isVerified) || b.viewCount - a.viewCount)
      .slice(0, 6),
  };
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function getPropertyBySlug(slug: string) {
  return getStore().propertyBySlug.get(slug) ?? null;
}
export function getProjectBySlug(slug: string) {
  return getStore().projectBySlug.get(slug) ?? null;
}
export function getLocalityBySlug(slug: string) {
  return getStore().localityBySlug.get(slug) ?? null;
}
export function getPropertiesByIds(ids: string[]) {
  const store = getStore();
  return ids.map((id) => store.propertyById.get(id)).filter((p): p is Property => !!p);
}
export function getProjectProperties(projectId: string) {
  return getStore().propertiesByProject.get(projectId) ?? [];
}
export function getDeveloper(id: string) {
  return getStore().developerById.get(id) ?? null;
}
export function getLocality(id: string) {
  return getStore().localityById.get(id) ?? null;
}
/** Every listing inside a locality — used by the locality page's own map. */
export function propertiesInLocality(localityId: string) {
  return getStore().propertiesByLocality.get(localityId) ?? [];
}

export function allLocalities() {
  return getStore().localities;
}
export function allProjects() {
  return getStore().projects;
}
export function allDevelopers() {
  return getStore().developers;
}

/** Similar homes: same locality, comparable size and price. */
export function similarProperties(p: Property, limit = 4): Property[] {
  const store = getStore();
  const pool = store.propertiesByLocality.get(p.localityId) ?? [];
  return pool
    .filter((x) => x.id !== p.id && x.listingType === p.listingType)
    .map((x) => ({
      x,
      d:
        Math.abs(x.price - p.price) / Math.max(p.price, 1) +
        Math.abs(x.builtupAreaSqft - p.builtupAreaSqft) / Math.max(p.builtupAreaSqft, 1) +
        (x.bedrooms === p.bedrooms ? 0 : 0.4),
    }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((r) => r.x);
}

export type { SpatialCluster as Cluster };

export interface CorridorRentBuy {
  slug: string;
  name: string;
  corridor: string;
  center: LatLng;
  /** Median asking price for this configuration here. */
  medianPrice: number;
  /** Median asking rent for the same configuration, per month. */
  medianRent: number;
  medianMaintenance: number;
  medianAreaSqft: number;
  avgPriceSqft: number;
  /** Annual price movement, modelled from listed inventory. */
  momentumPct: number;
  /** medianRent × 12 ÷ medianPrice — the yield the two sides of the book imply. */
  grossYieldPct: number;
  buySample: number;
  rentSample: number;
  /** Where the rent figure came from. The UI must say which. */
  rentBasis: "locality" | "corridor" | "modelled";
  /** `listed` when real rental listings set the figure, `estimated` when a model did. */
  rentQuality: DataQuality;
}

function median(ns: number[]): number {
  if (!ns.length) return 0;
  const s = [...ns].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * How many listings a median needs before it is worth quoting.
 *
 * At four, one unusual listing moves the figure enough to reorder the whole
 * ranking — a single cheap 3 BHK let put one corridor's implied yield at 1.8%
 * and sent it to the bottom of the city. Six is the point at which the medians
 * stopped jumping between configurations.
 */
const MIN_SAMPLE = 6;

/**
 * The two sides of the book, matched corridor by corridor.
 *
 * A rent-or-buy answer is only honest here because the same market holds both
 * sale and rental listings of the same configuration — so the price and the
 * rent being compared describe the same kind of home in the same place, rather
 * than a local price against a national average.
 *
 * Rents are scarcer than prices: roughly a fifth of listings are lets, and
 * splitting those by locality *and* bedroom count leaves samples too thin to
 * quote. So the rent is taken at the narrowest level that has enough of them —
 * the locality, else its corridor, else the locality's modelled yield — and
 * every row carries which of the three it used. Widening beats both
 * alternatives: dropping thin corridors reads as "no data anywhere", and
 * quoting a four-listing median reads as precision that isn't there.
 *
 * Only residential configurations are considered: plots earn no rent and
 * commercial shells let on terms this arithmetic does not describe.
 */
export function corridorRentBuy(bedrooms: number): CorridorRentBuy[] {
  const store = getStore();

  const eligible = store.properties.filter(
    (p) =>
      p.bedrooms === bedrooms &&
      p.propertyType !== "plot" &&
      p.propertyType !== "commercial",
  );

  /**
   * Corridor-level rent, carried between localities as a *yield* rather than a
   * rent per sq.ft.
   *
   * Rent per sq.ft was the obvious unit and it was wrong: multiplying a
   * corridor's rate by a locality whose homes happen to be unusually large
   * invented rents, and one corridor came back implying a 7.6% gross yield in a
   * city that runs 2–4%. A yield is dimensionless, so it survives the move
   * between localities of different sizes and stays inside a plausible band by
   * construction.
   */
  const corridorRentPsf = new Map<string, number[]>();
  const corridorPricePsf = new Map<string, number[]>();
  for (const p of eligible) {
    const loc = store.localityById.get(p.localityId);
    if (!loc || !p.builtupAreaSqft) continue;
    if (p.listingType === "rent" && p.rentMonthly) {
      const bucket = corridorRentPsf.get(loc.corridor) ?? [];
      bucket.push(p.rentMonthly / p.builtupAreaSqft);
      corridorRentPsf.set(loc.corridor, bucket);
    } else if (p.listingType === "buy") {
      const bucket = corridorPricePsf.get(loc.corridor) ?? [];
      bucket.push(p.price / p.builtupAreaSqft);
      corridorPricePsf.set(loc.corridor, bucket);
    }
  }

  const out: CorridorRentBuy[] = [];

  for (const loc of store.localities) {
    const here = eligible.filter((p) => p.localityId === loc.id);
    const buys = here.filter((p) => p.listingType === "buy");
    // Without a credible sale price there is nothing to compare a rent against.
    if (buys.length < MIN_SAMPLE) continue;

    const medianPrice = median(buys.map((p) => p.price));
    const medianAreaSqft = Math.round(median(buys.map((p) => p.builtupAreaSqft)));

    const rents = here.filter((p) => p.listingType === "rent" && p.rentMonthly);
    const pooledRent = corridorRentPsf.get(loc.corridor) ?? [];
    const pooledPrice = corridorPricePsf.get(loc.corridor) ?? [];

    let medianRent: number;
    let rentBasis: CorridorRentBuy["rentBasis"];
    if (rents.length >= MIN_SAMPLE) {
      medianRent = median(rents.map((p) => p.rentMonthly!));
      rentBasis = "locality";
    } else if (pooledRent.length >= MIN_SAMPLE && pooledPrice.length >= MIN_SAMPLE) {
      // The corridor's own gross yield, applied to what this locality sells for.
      const corridorYield = (median(pooledRent) * 12) / median(pooledPrice);
      medianRent = Math.round(((medianPrice * corridorYield) / 12 / 500) * 500);
      rentBasis = "corridor";
    } else {
      medianRent = Math.round(((medianPrice * (loc.rentalYieldPct / 100)) / 12 / 500) * 500);
      rentBasis = "modelled";
    }

    out.push({
      slug: loc.slug,
      name: loc.name,
      corridor: loc.corridor,
      center: loc.center,
      medianPrice,
      medianRent,
      medianMaintenance: median(here.map((p) => p.maintenanceMonthly)),
      medianAreaSqft,
      avgPriceSqft: loc.avgPriceSqft,
      momentumPct: loc.momentumPct,
      grossYieldPct: medianPrice ? ((medianRent * 12) / medianPrice) * 100 : 0,
      buySample: buys.length,
      rentSample: rentBasis === "locality" ? rents.length : pooledRent.length,
      rentBasis,
      rentQuality: rentBasis === "modelled" ? "estimated" : "listed",
    });
  }

  // Dearest first: the ranking reads as a spectrum of the city, and a buyer
  // finds where they sit on it faster by price than alphabetically.
  return out.sort((a, b) => b.avgPriceSqft - a.avgPriceSqft);
}
