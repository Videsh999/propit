import type { PropertyFilters } from "@/types";

export const DEFAULT_FILTERS: PropertyFilters = {
  listingType: "buy",
  propertyTypes: [],
  bedrooms: [],
  priceMin: null,
  priceMax: null,
  areaMin: null,
  areaMax: null,
  possession: [],
  amenities: [],
  localitySlugs: [],
  verifiedOnly: false,
};

export function activeFilterCount(f: PropertyFilters): number {
  let n = 0;
  if (f.propertyTypes.length) n++;
  if (f.bedrooms.length) n++;
  if (f.priceMin != null || f.priceMax != null) n++;
  if (f.areaMin != null || f.areaMax != null) n++;
  if (f.possession.length) n++;
  if (f.amenities.length) n++;
  if (f.localitySlugs.length) n++;
  if (f.verifiedOnly) n++;
  return n;
}
