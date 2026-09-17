"use client";

import { useDiscovery } from "@/store/discovery";
import type { Bounds } from "@/types";

/**
 * Has the user moved far enough from what they were shown to be looking at
 * somewhere else?
 *
 * Tolerance is a fraction of the viewport's own width, so the prompt behaves
 * the same whether the map is showing the whole city or one street. Nudging the
 * map should not accuse the user of having gone somewhere.
 */
export function boundsDrifted(shown: Bounds | null, now: Bounds | null): boolean {
  if (!shown || !now) return false;
  const tol = Math.abs(shown.east - shown.west) * 0.18;
  return (
    Math.abs(shown.west - now.west) > tol ||
    Math.abs(shown.east - now.east) > tol ||
    Math.abs(shown.north - now.north) > tol ||
    Math.abs(shown.south - now.south) > tol
  );
}

export function useBoundsDrift(): boolean {
  const searchedBounds = useDiscovery((s) => s.searchedBounds);
  const bounds = useDiscovery((s) => s.bounds);
  return boundsDrifted(searchedBounds, bounds);
}
