"use client";

import { useQuery } from "@tanstack/react-query";
import { ORR_URL } from "@/lib/map/viewport";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * The Outer Ring Road geometry, fetched as a static asset.
 *
 * It is ~2,000 coordinate pairs of real OSM data. Served rather than bundled so
 * it never delays first paint, and cached indefinitely because a ring road does
 * not move.
 */
export function useOrr() {
  const { data } = useQuery<GeoJSON.FeatureCollection>({
    queryKey: ["orr"],
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    queryFn: async ({ signal }) => {
      const res = await fetch(ORR_URL, { signal });
      if (!res.ok) throw new Error("ORR geometry unavailable");
      return res.json();
    },
  });
  // The map renders fine without it; the ring simply isn't drawn.
  return data ?? EMPTY;
}
