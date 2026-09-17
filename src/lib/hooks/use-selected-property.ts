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
export function useSelectedProperty() {
  const selectedId = useDiscovery((s) => s.selectedPropertyId);
  const preview = useDiscovery((s) => s.previewProperty);
  const anchors = useDiscovery((s) => s.anchors);
  const filters = useDiscovery((s) => s.filters);
  const select = useDiscovery((s) => s.select);

  const missing = !!selectedId && preview?.id !== selectedId;

  const { data } = useQuery<{ items: ScoredProperty[] }>({
    queryKey: ["property-preview", selectedId, anchors.length, filters.listingType],
    enabled: missing,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const p = new URLSearchParams({ ids: selectedId!, type: filters.listingType });
      if (anchors.length) p.set("anchors", JSON.stringify(anchors));
      if (filters.priceMin != null) p.set("minPrice", String(filters.priceMin));
      if (filters.priceMax != null) p.set("maxPrice", String(filters.priceMax));
      const res = await fetch(`/api/properties/by-id?${p.toString()}`, { signal });
      if (!res.ok) throw new Error("Couldn't load that home.");
      return res.json();
    },
  });

  useEffect(() => {
    const found = data?.items?.[0];
    // Guard on the id: a slow response for a marker the user has already moved
    // past must not overwrite their current selection.
    if (found && found.id === useDiscovery.getState().selectedPropertyId) {
      select(found.id, found);
    }
  }, [data, select]);
}
