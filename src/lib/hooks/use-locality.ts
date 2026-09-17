"use client";

import { useQuery } from "@tanstack/react-query";
import type { Locality, NearbyPlace, Project, Property } from "@/types";

export interface LocalityIntelligenceResponse {
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
  connectivity: NearbyPlace[];
  topProjects: Project[];
  featured: Property[];
}

export function useLocality(slug: string | null) {
  return useQuery<LocalityIntelligenceResponse>({
    queryKey: ["locality", slug],
    enabled: !!slug,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/localities/${slug}/intelligence`, { signal });
      if (!res.ok) throw new Error("We don't have that locality yet.");
      return res.json();
    },
  });
}

export function useNearby(
  point: { lat: number; lng: number } | null,
  categories?: string[],
  radiusKm = 6,
) {
  return useQuery<{ places: NearbyPlace[] }>({
    queryKey: ["nearby", point?.lat, point?.lng, categories?.join(","), radiusKm],
    enabled: !!point,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const p = new URLSearchParams({
        lat: String(point!.lat),
        lng: String(point!.lng),
        radiusKm: String(radiusKm),
      });
      if (categories?.length) p.set("categories", categories.join(","));
      const res = await fetch(`/api/poi/nearby?${p}`, { signal });
      if (!res.ok) throw new Error("Couldn't load nearby places.");
      return res.json();
    },
  });
}
