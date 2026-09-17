import type { LatLng } from "@/types";

/**
 * Distance maths that both sides of the wire need.
 *
 * `spatial.ts` is server-only — it backs the repository and must never be
 * bundled into the client. But the browser still has to answer small geographic
 * questions (which locality is the map looking at?), so the handful of pure
 * functions with no server dependency live here and are re-exported there.
 */

const R_EARTH_KM = 6371.0088;

export const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Circle as a closed ring of [lng, lat], geodesically correct enough at city scale. */
export function circleRing(center: LatLng, radiusKm: number, steps = 96): [number, number][] {
  const ring: [number, number][] = [];
  const latR = radiusKm / 110.574;
  const lngR = radiusKm / (111.32 * Math.cos(toRad(center.lat)));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ring.push([center.lng + lngR * Math.cos(a), center.lat + latR * Math.sin(a)]);
  }
  return ring;
}
