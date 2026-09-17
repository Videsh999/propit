"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useMemo } from "react";
import { useDiscovery } from "@/store/discovery";
import type { Bounds, Poi, PoiCategory } from "@/types";

export interface PoiViewportResponse {
  counts: Partial<Record<PoiCategory, number>>;
  places: Poi[];
}

const EMPTY: PoiViewportResponse = { counts: {}, places: [] };

/** Quantised so a pan of a few metres doesn't invalidate the query. */
function key(b: Bounds) {
  return [b.west, b.south, b.east, b.north].map((n) => n.toFixed(2)).join(",");
}

/**
 * Nearby places for whatever the map is currently showing.
 *
 * The counts drive the Nearby panel and the places drive the map layer, and
 * both come from the same request — so a category that reads "10 schools"
 * always draws ten schools.
 */
export function usePoiViewport(enabled = true) {
  const bounds = useDiscovery((s) => s.bounds);
  const layers = useDiscovery((s) => s.layers);

  const active = useMemo(
    () =>
      (Object.keys(layers) as (PoiCategory | "localities" | "projects" | "priceHeat")[])
        .filter(
          (k): k is PoiCategory =>
            layers[k] && k !== "localities" && k !== "projects" && k !== "priceHeat",
        )
        .sort(),
    [layers],
  );

  const query = useQuery<PoiViewportResponse>({
    queryKey: ["poi-viewport", bounds ? key(bounds) : null, active.join(",")],
    enabled: enabled && !!bounds,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const b = bounds!;
      const p = new URLSearchParams({
        west: b.west.toFixed(4),
        south: b.south.toFixed(4),
        east: b.east.toFixed(4),
        north: b.north.toFixed(4),
      });
      if (active.length) p.set("categories", active.join(","));
      const res = await fetch(`/api/poi/viewport?${p.toString()}`, { signal });
      if (!res.ok) throw new Error("Couldn't load nearby places.");
      return res.json();
    },
  });

  return { ...query, data: query.data ?? EMPTY, active };
}
