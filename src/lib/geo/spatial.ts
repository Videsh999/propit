import type { Bounds, LatLng } from "@/types";
import { circleRing, haversineKm, toRad } from "./distance";

// Re-exported so server callers keep a single import for all spatial maths,
// while the client can reach the pure parts without pulling this module in.
export { circleRing, haversineKm };

/** Cheap squared planar distance for hot loops — only valid for local comparisons. */
export function fastDistSq(a: LatLng, b: LatLng): number {
  const kx = Math.cos(toRad((a.lat + b.lat) / 2));
  const dx = (a.lng - b.lng) * kx;
  const dy = a.lat - b.lat;
  return dx * dx + dy * dy;
}

export function boundsContains(bounds: Bounds, p: LatLng): boolean {
  return (
    p.lng >= bounds.west &&
    p.lng <= bounds.east &&
    p.lat >= bounds.south &&
    p.lat <= bounds.north
  );
}

export function boundsFromPoints(points: LatLng[], padPct = 0.12): Bounds | null {
  if (!points.length) return null;
  let west = 180,
    east = -180,
    south = 90,
    north = -90;
  for (const p of points) {
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
  }
  const padX = Math.max((east - west) * padPct, 0.004);
  const padY = Math.max((north - south) * padPct, 0.004);
  return {
    west: west - padX,
    east: east + padX,
    south: south - padY,
    north: north + padY,
  };
}

export function boundsCenter(b: Bounds): LatLng {
  return { lat: (b.north + b.south) / 2, lng: (b.east + b.west) / 2 };
}

/** Rough diagonal span of a bounds box, in km. */
export function boundsSpanKm(b: Bounds): number {
  return haversineKm({ lat: b.south, lng: b.west }, { lat: b.north, lng: b.east });
}

/** Ray casting. ring is [lng, lat][] and may or may not be closed. */
export function pointInRing(p: LatLng, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1];
    const xj = ring[j][0],
      yj = ring[j][1];
    const intersect =
      yi > p.lat !== yj > p.lat &&
      p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function ringToFeature(ring: [number, number][], props: Record<string, unknown> = {}) {
  return {
    type: "Feature" as const,
    properties: props,
    geometry: { type: "Polygon" as const, coordinates: [ring] },
  };
}

/**
 * Intersection of N circles, approximated by sampling the smallest circle's
 * disc on a polar grid and keeping the region inside every other circle.
 * Returns a convex-ish hull ring, or null when the circles do not overlap.
 * This is the shape painted as the Livable Zone.
 */
export function intersectCircles(
  circles: { center: LatLng; radiusKm: number }[],
): [number, number][] | null {
  if (!circles.length) return null;
  if (circles.length === 1) return circleRing(circles[0].center, circles[0].radiusKm);

  const smallest = circles.reduce((a, b) => (a.radiusKm < b.radiusKm ? a : b));
  const inAll = (p: LatLng) =>
    circles.every((c) => haversineKm(c.center, p) <= c.radiusKm + 1e-9);

  const RAYS = 128;
  const STEPS = 44;
  const hull: [number, number][] = [];

  for (let i = 0; i < RAYS; i++) {
    const theta = (i / RAYS) * Math.PI * 2;
    let best: LatLng | null = null;
    // Walk outward from the centre; keep the furthest point still inside every circle.
    for (let s = 0; s <= STEPS; s++) {
      const r = (s / STEPS) * smallest.radiusKm;
      const latR = r / 110.574;
      const lngR = r / (111.32 * Math.cos(toRad(smallest.center.lat)));
      const p = {
        lat: smallest.center.lat + latR * Math.sin(theta),
        lng: smallest.center.lng + lngR * Math.cos(theta),
      };
      if (inAll(p)) best = p;
      else if (best) break;
    }
    if (best) hull.push([best.lng, best.lat]);
  }

  if (hull.length < 8) return null;
  hull.push(hull[0]);
  return hull;
}

/** Centroid of a ring — used to fly the camera to the zone. */
export function ringCentroid(ring: [number, number][]): LatLng {
  let x = 0,
    y = 0;
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    x += ring[i][0];
    y += ring[i][1];
  }
  return { lng: x / n, lat: y / n };
}

/** Approximate ring area in km². */
export function ringAreaKm2(ring: [number, number][]): number {
  let area = 0;
  const n = ring.length - 1;
  const latRef = ring[0][1];
  const kx = 111.32 * Math.cos(toRad(latRef));
  const ky = 110.574;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    area += x1 * kx * (y2 * ky) - x2 * kx * (y1 * ky);
  }
  return Math.abs(area / 2);
}

/**
 * Grid clustering — the server-side equivalent of ST_ClusterDBSCAN.
 * Keeps the browser under its feature budget at low zooms.
 */
export interface Cluster {
  id: string;
  center: LatLng;
  count: number;
  minPrice: number;
  ids: string[];
}

export function clusterPoints(
  items: { id: string; location: LatLng; price: number }[],
  zoom: number,
): Cluster[] {
  // Cell size shrinks as we zoom in. Tuned against Hyderabad's footprint so a
  // city-wide view yields ~30-60 clusters rather than a handful of blobs.
  const cell = (360 / Math.pow(2, zoom)) * 0.22;
  const buckets = new Map<string, { pts: typeof items; sumLat: number; sumLng: number }>();

  for (const it of items) {
    const gx = Math.floor(it.location.lng / cell);
    const gy = Math.floor(it.location.lat / cell);
    const key = `${gx}:${gy}`;
    let b = buckets.get(key);
    if (!b) {
      b = { pts: [], sumLat: 0, sumLng: 0 };
      buckets.set(key, b);
    }
    b.pts.push(it);
    b.sumLat += it.location.lat;
    b.sumLng += it.location.lng;
  }

  const out: Cluster[] = [];
  for (const [key, b] of buckets) {
    const n = b.pts.length;
    out.push({
      id: `c_${key}`,
      center: { lat: b.sumLat / n, lng: b.sumLng / n },
      count: n,
      minPrice: Math.min(...b.pts.map((p) => p.price)),
      ids: b.pts.map((p) => p.id),
    });
  }
  return out;
}

/** Deterministic pseudo-random point inside a ring, used only by the seeder. */
export function randomPointInRing(
  ring: [number, number][],
  rnd: () => number,
  attempts = 60,
): LatLng | null {
  let west = 180,
    east = -180,
    south = 90,
    north = -90;
  for (const [lng, lat] of ring) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  for (let i = 0; i < attempts; i++) {
    const p = {
      lng: west + rnd() * (east - west),
      lat: south + rnd() * (north - south),
    };
    if (pointInRing(p, ring)) return p;
  }
  return null;
}
