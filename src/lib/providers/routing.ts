import type { LatLng, TravelLeg } from "@/types";
import { haversineKm } from "@/lib/geo/spatial";

/**
 * Routing provider contract.
 *
 * The dev implementation derives travel time from straight-line distance and
 * MUST be surfaced to the user as "estimated". Never present an estimate as a
 * measurement — every consumer reads `leg.estimated` and labels accordingly.
 */
export interface RoutingProvider {
  readonly name: string;
  readonly isEstimate: boolean;
  matrix(origins: LatLng[], destinations: LatLng[], mode?: "drive"): Promise<TravelLeg[][]>;
  /** Returns null when the provider cannot produce a real isochrone. */
  isochrone(center: LatLng, minutes: number, mode?: "drive"): Promise<[number, number][] | null>;
}

/**
 * Hyderabad-tuned straight-line estimator.
 *
 * Road factor 1.35 accounts for the street network detour ratio; effective
 * speed falls on short hops (junctions, signals) and rises on longer runs
 * (ORR, expressways).
 */
const ROAD_FACTOR = 1.35;

function effectiveSpeedKmh(roadKm: number): number {
  if (roadKm < 2) return 14;
  if (roadKm < 5) return 19;
  if (roadKm < 12) return 24;
  if (roadKm < 25) return 32;
  return 42;
}

export function estimateLeg(a: LatLng, b: LatLng): TravelLeg {
  const straight = haversineKm(a, b);
  const roadKm = straight * ROAD_FACTOR;
  const minutes = (roadKm / effectiveSpeedKmh(roadKm)) * 60;
  return {
    distanceKm: Math.round(straight * 100) / 100,
    minutes: Math.round(minutes),
    estimated: true,
    mode: "drive",
  };
}

class EstimateRoutingProvider implements RoutingProvider {
  readonly name = "straight-line-estimate";
  readonly isEstimate = true;

  async matrix(origins: LatLng[], destinations: LatLng[]): Promise<TravelLeg[][]> {
    return origins.map((o) => destinations.map((d) => estimateLeg(o, d)));
  }

  /** No real road network available — callers fall back to distance buffers. */
  async isochrone(): Promise<null> {
    return null;
  }
}

class OpenRouteServiceProvider implements RoutingProvider {
  readonly name = "openrouteservice";
  readonly isEstimate = false;
  constructor(private key: string) {}

  async matrix(origins: LatLng[], destinations: LatLng[]): Promise<TravelLeg[][]> {
    const body = {
      locations: [...origins, ...destinations].map((p) => [p.lng, p.lat]),
      sources: origins.map((_, i) => i),
      destinations: destinations.map((_, i) => origins.length + i),
      metrics: ["distance", "duration"],
      units: "km",
    };
    const res = await fetch(
      "https://api.openrouteservice.org/v2/matrix/driving-car",
      {
        method: "POST",
        headers: { Authorization: this.key, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) throw new Error(`ORS matrix failed: ${res.status}`);
    const json = (await res.json()) as {
      distances: number[][];
      durations: number[][];
    };
    return json.distances.map((row, i) =>
      row.map((km, j) => ({
        distanceKm: Math.round(km * 100) / 100,
        minutes: Math.round(json.durations[i][j] / 60),
        estimated: false,
        mode: "drive" as const,
      })),
    );
  }

  async isochrone(center: LatLng, minutes: number): Promise<[number, number][] | null> {
    const res = await fetch(
      "https://api.openrouteservice.org/v2/isochrones/driving-car",
      {
        method: "POST",
        headers: { Authorization: this.key, "Content-Type": "application/json" },
        body: JSON.stringify({
          locations: [[center.lng, center.lat]],
          range: [minutes * 60],
          range_type: "time",
        }),
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      features: { geometry: { coordinates: [number, number][][] } }[];
    };
    return json.features?.[0]?.geometry?.coordinates?.[0] ?? null;
  }
}

let cached: RoutingProvider | null = null;

export function getRoutingProvider(): RoutingProvider {
  if (cached) return cached;
  const key = process.env.ORS_API_KEY;
  cached =
    process.env.ROUTING_PROVIDER === "ors" && key
      ? new OpenRouteServiceProvider(key)
      : new EstimateRoutingProvider();
  return cached;
}
