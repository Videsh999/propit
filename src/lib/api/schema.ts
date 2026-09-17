import { z } from "zod";

export const listingTypeSchema = z.enum(["buy", "rent"]);
export const propertyTypeSchema = z.enum([
  "apartment",
  "villa",
  "plot",
  "independent_house",
  "penthouse",
  "farmhouse",
  "commercial",
]);
export const possessionSchema = z.enum([
  "ready",
  "within_6_months",
  "within_1_year",
  "under_construction",
]);
export const poiCategorySchema = z.enum([
  "metro",
  "school",
  "hospital",
  "office_hub",
  "mall",
  "park",
  "stadium",
  "airport",
  "railway",
  "restaurant",
  "gym",
  "temple",
]);

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const boundsSchema = z.object({
  west: z.number(),
  south: z.number(),
  east: z.number(),
  north: z.number(),
});

export const filtersSchema = z.object({
  listingType: listingTypeSchema.default("buy"),
  propertyTypes: z.array(propertyTypeSchema).default([]),
  bedrooms: z.array(z.number().int().min(0).max(10)).default([]),
  priceMin: z.number().nonnegative().nullable().default(null),
  priceMax: z.number().nonnegative().nullable().default(null),
  areaMin: z.number().nonnegative().nullable().default(null),
  areaMax: z.number().nonnegative().nullable().default(null),
  possession: z.array(possessionSchema).default([]),
  amenities: z.array(z.string().max(40)).max(20).default([]),
  localitySlugs: z.array(z.string().max(60)).max(40).default([]),
  verifiedOnly: z.boolean().default(false),
});

export const anchorSchema = z.object({
  id: z.string().max(60),
  label: z.string().max(60),
  kind: z.enum(["office", "school", "family", "gym", "other"]),
  location: latLngSchema,
  address: z.string().max(200).default(""),
  maxKm: z.number().min(0.2).max(60),
  weight: z.number().min(0.25).max(3).default(1),
});

export const zoneRequestSchema = z.object({
  anchors: z.array(anchorSchema).max(6).default([]),
  filters: filtersSchema.partial().default({}),
  limit: z.number().int().min(0).max(100).default(40),
});

export const naturalRequestSchema = z.object({
  query: z.string().min(1).max(500),
  context: z
    .object({
      filters: filtersSchema.partial().optional(),
      anchors: z.array(anchorSchema).max(6).optional(),
      center: latLngSchema.optional(),
    })
    .default({}),
});

/** Parses the querystring form used by /api/properties. */
export function parsePropertyQuery(sp: URLSearchParams) {
  const num = (k: string) => {
    const v = sp.get(k);
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const list = (k: string) =>
    (sp.get(k) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const west = num("west");
  const south = num("south");
  const east = num("east");
  const north = num("north");
  const bounds =
    west != null && south != null && east != null && north != null
      ? { west, south, east, north }
      : null;

  const filters = filtersSchema.parse({
    listingType: sp.get("type") ?? "buy",
    propertyTypes: list("propertyType"),
    bedrooms: list("bhk").map(Number).filter(Number.isFinite),
    priceMin: num("minPrice"),
    priceMax: num("maxPrice"),
    areaMin: num("minArea"),
    areaMax: num("maxArea"),
    possession: list("possession"),
    amenities: list("amenities"),
    localitySlugs: list("locality"),
    verifiedOnly: sp.get("verified") === "1",
  });

  const lat = num("lat");
  const lng = num("lng");

  return {
    filters,
    bounds,
    center: lat != null && lng != null ? { lat, lng } : null,
    radiusKm: num("radiusKm"),
    zoom: num("zoom") ?? 11,
    limit: Math.min(Math.max(num("limit") ?? 40, 0), 100),
    offset: Math.max(num("offset") ?? 0, 0),
    sort: (sp.get("sort") ?? "relevance") as
      | "relevance"
      | "price_asc"
      | "price_desc"
      | "newest"
      | "area_desc"
      | "fit",
  };
}
