import { propertyTypeLabel } from "@/lib/format";
import type { ListingType, Property, PropertyType } from "@/types";

export type ProjectListing = Pick<Property, "id" | "slug" | "title" | "listingType" | "propertyType" | "price" | "rentMonthly" | "bedrooms" | "builtupAreaSqft"> & { image?: string };
export type ProjectSort = "price_asc" | "price_desc" | "area_desc";

export function uniqueProjectPhotos(images: string[]) {
  const seen = new Set<string>();
  return images.filter(image => {
    if (!image) return false;
    let key = image;
    try { const url = new URL(image); if (url.hostname === "images.unsplash.com") key = url.origin + url.pathname; } catch { /* Local asset paths keep their own identity. */ }
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export function configurationLabel(listing: Pick<ProjectListing, "propertyType" | "bedrooms">) {
  if (listing.propertyType === "plot" || listing.propertyType === "commercial") return propertyTypeLabel(listing.propertyType);
  return listing.bedrooms === 0 ? "Studio" : `${listing.bedrooms} BHK`;
}

export function filterProjectListings(listings: ProjectListing[], options: { mode: ListingType; type?: PropertyType | ""; configuration?: string; sort: ProjectSort }) {
  return listings.filter(listing => listing.listingType === options.mode && (!options.type || listing.propertyType === options.type) && (!options.configuration || configurationLabel(listing) === options.configuration))
    .sort((a, b) => {
      if (options.sort === "area_desc") return b.builtupAreaSqft - a.builtupAreaSqft;
      const price = (item: ProjectListing) => { const value = options.mode === "rent" ? item.rentMonthly : item.price; return value != null && value > 0 ? value : null; };
      const first = price(a), second = price(b);
      if (first == null || second == null) return first == null ? second == null ? 0 : 1 : -1;
      return options.sort === "price_desc" ? second - first : first - second;
    });
}

export function median(values: number[]) {
  const sorted = values.filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Asking-price summaries only; these are not registered sales or valuations. */
export function projectPricePoints(listings: ProjectListing[], mode: ListingType) {
  const groups = new Map<string, number[]>();
  for (const listing of listings) {
    if (listing.listingType !== mode) continue;
    const value = mode === "rent" ? listing.rentMonthly : listing.builtupAreaSqft > 0 ? listing.price / listing.builtupAreaSqft : null;
    if (value == null || !Number.isFinite(value) || value <= 0) continue;
    const label = configurationLabel(listing);
    groups.set(label, [...(groups.get(label) ?? []), value]);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true })).map(([label, values]) => ({ label, value: median(values)!, count: values.length, min: Math.min(...values), max: Math.max(...values) }));
}
