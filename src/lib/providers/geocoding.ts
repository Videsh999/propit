import type { LatLng } from "@/types";
import { POIS } from "@/lib/data/pois";
import { LOCALITIES } from "@/lib/data/localities";
import { haversineKm } from "@/lib/geo/spatial";

export interface GeoPlace {
  id: string;
  name: string;
  context: string;
  location: LatLng;
  kind: "locality" | "poi" | "external";
}

export interface GeocodingProvider {
  readonly name: string;
  search(q: string, near?: LatLng, limit?: number): Promise<GeoPlace[]>;
}

/**
 * Local provider — resolves against PropIT's own localities and POIs.
 * Zero network, instant, and always available. Photon is layered on top when
 * the query finds nothing local.
 */
class LocalGeocodingProvider implements GeocodingProvider {
  readonly name = "local";

  async search(q: string, near?: LatLng, limit = 8): Promise<GeoPlace[]> {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const out: (GeoPlace & { score: number })[] = [];

    for (const l of LOCALITIES) {
      const n = l.name.toLowerCase();
      if (!n.includes(needle)) continue;
      out.push({
        id: l.id,
        name: l.name,
        context: `${l.corridor} · Hyderabad`,
        location: l.center,
        kind: "locality",
        score: (n.startsWith(needle) ? 0 : 10) + n.length / 100,
      });
    }

    for (const p of POIS) {
      const n = p.name.toLowerCase();
      if (!n.includes(needle)) continue;
      out.push({
        id: p.id,
        name: p.name,
        context: p.subcategory,
        location: p.location,
        kind: "poi",
        score:
          (n.startsWith(needle) ? 2 : 12) +
          (p.verified ? 0 : 3) +
          n.length / 100 +
          (near ? haversineKm(near, p.location) / 50 : 0),
      });
    }

    return out
      .sort((a, b) => a.score - b.score)
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        name: r.name,
        context: r.context,
        location: r.location,
        kind: r.kind,
      }));
  }
}

/** Photon (OSM, keyless) for anything outside PropIT's own dataset. */
class PhotonGeocodingProvider implements GeocodingProvider {
  readonly name = "photon";
  private local = new LocalGeocodingProvider();

  async search(q: string, near?: LatLng, limit = 8): Promise<GeoPlace[]> {
    const local = await this.local.search(q, near, limit);
    if (local.length >= 4) return local;
    try {
      const url = new URL("https://photon.komoot.io/api/");
      url.searchParams.set("q", q);
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("lat", String(near?.lat ?? 17.4275));
      url.searchParams.set("lon", String(near?.lng ?? 78.4));
      const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (!res.ok) return local;
      const json = (await res.json()) as {
        features: {
          properties: { name?: string; city?: string; state?: string; osm_id?: number };
          geometry: { coordinates: [number, number] };
        }[];
      };
      const remote: GeoPlace[] = json.features
        .filter((f) => f.properties.name)
        .map((f) => ({
          id: `ext_${f.properties.osm_id}`,
          name: f.properties.name!,
          context: [f.properties.city, f.properties.state].filter(Boolean).join(", "),
          location: { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] },
          kind: "external" as const,
        }));
      const seen = new Set(local.map((l) => l.name.toLowerCase()));
      return [...local, ...remote.filter((r) => !seen.has(r.name.toLowerCase()))].slice(0, limit);
    } catch {
      // Network is optional — local results are always enough to keep going.
      return local;
    }
  }
}

let cached: GeocodingProvider | null = null;
export function getGeocodingProvider(): GeocodingProvider {
  if (cached) return cached;
  cached =
    process.env.GEOCODING_PROVIDER === "local"
      ? new LocalGeocodingProvider()
      : new PhotonGeocodingProvider();
  return cached;
}
