"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDiscovery } from "@/store/discovery";
import type { ScoredProperty } from "@/types";

/**
 * Makes a map marker click open a preview.
 *
 * Selecting from the results list hands the store the whole property, because
 * the list already has it. The map only has an id — a marker is a point on a
 * GeoJSON source, not a record — so clicking one used to set an id, leave
 * `previewProperty` null, and render nothing at all. The single most important
 * gesture in a map-first product did nothing.
 *
 * This closes that gap: whenever an id is selected with no property behind it,
 * fetch the one property and put it in the store, scored against the anchors
 * currently in play so the preview says the same thing either way.
 */
export function useSelectedProperty(visibleListings?: ScoredProperty[]) {
  const selectedId = useDiscovery((s) => s.selectedPropertyId);
  const preview = useDiscovery((s) => s.previewProperty);
  const anchors = useDiscovery((s) => s.anchors);
  const filters = useDiscovery((s) => s.filters);
  const select = useDiscovery((s) => s.select);

  const missing = !!selectedId && preview?.id !== selectedId;
  const visible = missing ? visibleListings?.find((property) => property.id === selectedId) : undefined;
  const params = new URLSearchParams({ type: filters.listingType });
  if (selectedId) params.set("ids", selectedId);
  if (anchors.length) params.set("anchors", JSON.stringify(anchors));
  if (filters.priceMin != null) params.set("minPrice", String(filters.priceMin));
  if (filters.priceMax != null) params.set("maxPrice", String(filters.priceMax));
  const key = params.toString();

  const { data, isError, refetch } = useQuery<ScoredProperty>({
    queryKey: ["property-preview", key],
    enabled: missing && !visible,
    retry: 1,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/properties/by-id?${key}`, { signal });
      if (!res.ok) throw new Error("Couldn't load that home.");
      const { items } = await res.json() as { items: ScoredProperty[] };
      const found = items.find(({ id }) => id === selectedId);
      if (!found) throw new Error("This listing is unavailable.");
      return found;
    },
  });

  useEffect(() => {
    // Guard on the id: a slow response for a marker the user has already moved
    // past must not overwrite their current selection.
    const property = visible ?? data;
    if (missing && property && property.id === useDiscovery.getState().selectedPropertyId) {
      select(property.id, property);
    }
  }, [data, visible, missing, select]);

  return { isError: missing && isError, refetch };
}
