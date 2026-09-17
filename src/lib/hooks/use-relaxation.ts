"use client";

import { useCallback } from "react";
import { useDiscovery } from "@/store/discovery";
import type { PropertyFilters } from "@/types";

export interface RelaxationOption {
  kind: string;
  targetId: string | null;
  label: string;
  message: string;
  unlocked: number;
  patch: Record<string, unknown>;
}

/**
 * Applies a relaxation offer. Shared so the anchors panel and the empty state
 * can never drift apart on what "Apply" actually does.
 */
export function useApplyRelaxation() {
  const { updateAnchor, setFilters, anchors } = useDiscovery();

  return useCallback(
    (r: RelaxationOption) => {
      const patch = r.patch;

      if (typeof patch.anchorMultiplier === "number") {
        for (const a of anchors) {
          updateAnchor(a.id, {
            maxKm: Math.min(60, Math.round(a.maxKm * (patch.anchorMultiplier as number) * 10) / 10),
          });
        }
      } else if (r.kind === "anchor" && r.targetId && typeof patch.maxKm === "number") {
        updateAnchor(r.targetId, { maxKm: patch.maxKm });
      }

      // `null` here means "clear this filter", so check for presence of the key
      // rather than truthiness.
      const filterPatch: Partial<PropertyFilters> = {};
      if ("priceMax" in patch) filterPatch.priceMax = patch.priceMax as number | null;
      if ("priceMin" in patch) filterPatch.priceMin = patch.priceMin as number | null;
      if (Array.isArray(patch.bedrooms)) filterPatch.bedrooms = patch.bedrooms as number[];
      if (Array.isArray(patch.propertyTypes))
        filterPatch.propertyTypes = patch.propertyTypes as PropertyFilters["propertyTypes"];
      if (Array.isArray(patch.amenities)) filterPatch.amenities = patch.amenities as string[];
      if (Object.keys(filterPatch).length) setFilters(filterPatch);
    },
    [anchors, updateAnchor, setFilters],
  );
}
