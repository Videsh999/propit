"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useMemo } from "react";
import { useDiscovery, filtersToParams } from "@/store/discovery";
import type { ScoredProperty } from "@/types";
import type { MapPoint } from "@/components/map/propit-map";

export interface LocalityCount {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  count: number;
  avgPriceSqft: number;
  minPrice: number;
  momentumPct: number;
}

export interface PropertiesResponse {
  total: number;
  items: ScoredProperty[];
  points: MapPoint[];
  /** Matching homes just outside an active radius — drawn faded, never counted. */
  contextPoints: MapPoint[];
  localityCounts: LocalityCount[];
}

/**
 * The single source of truth for map + list. Both read this, so they can never
 * disagree about what is on screen.
 */
export function useProperties(opts: { limit?: number; enabled?: boolean } = {}) {
  const filters = useDiscovery((s) => s.filters);
  const anchors = useDiscovery((s) => s.anchors);
  const radius = useDiscovery((s) => s.radius);
  const polygon = useDiscovery((s) => s.polygon);
  const searchedBounds = useDiscovery((s) => s.searchedBounds);
  const useBounds = useDiscovery((s) => s.useBounds);
  const zoom = useDiscovery((s) => s.zoom);
  const sort = useDiscovery((s) => s.sort);

  const params = useMemo(() => {
    const p = filtersToParams(filters, anchors, radius);
    p.set("limit", String(opts.limit ?? 40));
    p.set("sort", sort);
    p.set("zoom", String(Math.round(zoom * 2) / 2));
    if (useBounds && searchedBounds) {
      p.set("west", searchedBounds.west.toFixed(4));
      p.set("south", searchedBounds.south.toFixed(4));
      p.set("east", searchedBounds.east.toFixed(4));
      p.set("north", searchedBounds.north.toFixed(4));
    }
    if (polygon)
      p.set("polygon", JSON.stringify(polygon.map(([a, b]) => [+a.toFixed(5), +b.toFixed(5)])));
    return p;
  }, [filters, anchors, radius, polygon, searchedBounds, useBounds, zoom, sort, opts.limit]);

  return useQuery<PropertiesResponse>({
    queryKey: ["properties", params.toString()],
    enabled: opts.enabled ?? true,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/properties?${params.toString()}`, { signal });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "We couldn't load properties.");
      }
      return res.json();
    },
  });
}

export interface ZoneResponse {
  zone: [number, number][] | null;
  areaKm2: number;
  total: number;
  items: ScoredProperty[];
  bounds: { west: number; south: number; east: number; north: number } | null;
  localityBreakdown: {
    slug: string;
    name: string;
    count: number;
    avgPriceSqft: number;
    medianPrice: number;
  }[];
  relaxations: {
    kind: string;
    targetId: string | null;
    label: string;
    message: string;
    unlocked: number;
    patch: Record<string, unknown>;
  }[];
  routingIsEstimate: boolean;
}

export function useZone() {
  const anchors = useDiscovery((s) => s.anchors);
  const filters = useDiscovery((s) => s.filters);

  return useQuery<ZoneResponse>({
    queryKey: ["zone", JSON.stringify(anchors), JSON.stringify(filters)],
    enabled: anchors.length > 0,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/properties/zone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anchors, filters, limit: 40 }),
        signal,
      });
      if (!res.ok) throw new Error("We couldn't work out your livable zone.");
      return res.json();
    },
  });
}

/** Hydrate a list of ids — saved homes, recently viewed, comparison. */
export function usePropertiesByIds(ids: string[]) {
  const key = ids.join(",");
  return useQuery<{ items: import("@/types").Property[] }>({
    queryKey: ["properties-by-id", key],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/properties/by-id?ids=${key}`, { signal });
      if (!res.ok) throw new Error("Couldn't load those homes.");
      return res.json();
    },
  });
}
