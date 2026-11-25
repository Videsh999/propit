import { z } from "zod";
import { communityUpdateSchema } from "@/lib/data/community";
import { latLngSchema, boundsSchema, listingTypeSchema, propertyTypeSchema, possessionSchema, poiCategorySchema } from "@/lib/api/schema";

const text = z.string().trim().max(20_000);
const id = z.string().min(1).max(120);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);
const amount = z.number().finite().nonnegative().max(1e13);
const count = z.number().int().nonnegative().max(100_000);
const quality = z.enum(["verified", "listed", "estimated"]);
const strings = z.array(z.string().max(1000)).max(100);
const url = z.string().max(2000).refine(value => {
  if (/^\/(?!\/)/.test(value) && !value.includes("\\")) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "Use an HTTPS URL or a local asset path.");
const percent = z.number().min(0).max(100);
const profile = z.object({
  communityUpdates: z.array(communityUpdateSchema).max(100).optional(),
  brochurePages: z.array(url).max(100).optional(),
  type: z.enum(["Apartment", "Villa", "Plot", "Mixed-use"]).optional(), category: z.enum(["Residential", "Commercial", "Mixed"]).optional(),
  launchDate: text.optional(), completionDate: text.optional(), reraCompletionDate: text.optional(),
  unitSizeRangeSqft: z.tuple([amount, amount]).optional(), unitFacings: strings.optional(), floorSpaceIndex: amount.optional(),
  openAreaPercent: percent.optional(), carpetAreaPercent: percent.optional(), clubhouseSqft: amount.optional(), ageYears: amount.optional(),
  highlights: strings.optional(), videoUrl: url.optional(), brochureUrl: url.optional(), costSheetUrl: url.optional(), masterPlanUrl: url.optional(),
  floorPlans: z.array(z.object({ configuration: text, url, unitSizeSqft: amount.optional(), facing: text.optional() })).max(100).optional(),
  specifications: z.record(z.string().max(50), text).optional(),
  credentials: z.array(z.object({ name: text, reference: text.optional(), url: url.optional() })).max(100).optional(),
  partners: z.array(z.object({ name: text, role: text })).max(100).optional(),
  reviews: z.array(z.object({ id, author: text, rating: z.number().min(0).max(5), text })).max(100).optional(),
  pros: strings.optional(), cons: strings.optional(), faqs: z.array(z.object({ question: text, answer: text })).max(100).optional(),
});

export const catalogSchema = z.object({
  city: z.object({ id, name: text, slug, center: latLngSchema, bounds: boundsSchema }),
  localities: z.array(z.object({
    id, cityId: id, name: text, slug, center: latLngSchema, boundary: z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).min(4).max(500),
    corridor: text, character: text, summary: text, avgPriceSqft: amount, medianPrice: amount, rentalYieldPct: amount,
    momentumPct: z.number().finite(), inventoryCount: count, projectCount: count, heroImage: url,
    priceHistory: z.array(z.object({ year: z.number().int().min(1900).max(2200), priceSqft: amount })).max(100), dataQuality: quality,
  })).min(1).max(1000),
  developers: z.array(z.object({ id, name: text, slug, establishedYear: z.number().int().min(1800).max(2200), projectsDelivered: count, reraRegistered: z.boolean(), about: text, logoMark: z.string().max(10) })).max(1000),
  projects: z.array(z.object({
    id, developerId: id, localityId: id, name: text, slug, location: latLngSchema, status: z.enum(["new_launch", "under_construction", "ready", "upcoming"]),
    possessionDate: text, reraNumber: text, reraVerified: z.boolean(), priceMin: amount, priceMax: amount, unitsTotal: count, unitsAvailable: count,
    landAreaAcres: amount, towers: count, floors: count, configurations: strings, description: text, heroImage: url, gallery: z.array(url).max(100), amenities: strings,
    dataQuality: quality, profile: profile.optional(),
  })).max(5000),
  properties: z.array(z.object({
    id, slug, projectId: id.nullable(), localityId: id, listingType: listingTypeSchema, propertyType: propertyTypeSchema, location: latLngSchema, title: text, address: text,
    price: amount, pricePerSqft: amount, rentMonthly: amount.nullable(), deposit: amount.nullable(), maintenanceMonthly: amount,
    carpetAreaSqft: amount, builtupAreaSqft: amount, superBuiltupAreaSqft: amount.nullable().optional(), floorPlanUrl: url.nullable().optional(),
    bedrooms: count, bathrooms: count, balconies: count, parking: count, floor: z.number().int().min(-10).max(200), totalFloors: count,
    facing: text, furnishing: z.enum(["unfurnished", "semi_furnished", "fully_furnished"]), ageYears: amount, possession: possessionSchema, availabilityDate: text,
    amenities: strings, images: z.array(z.object({ url, roomTag: text })).min(1).max(100), description: text,
    isVerified: z.boolean(), reraNumber: text.nullable(), dataQuality: quality, viewCount: count, createdAt: z.string().datetime(),
  })).min(1).max(20_000),
  pois: z.array(z.object({ id, cityId: id, name: text, category: poiCategorySchema, subcategory: text, location: latLngSchema, rating: z.number().min(0).max(5).nullable(), verified: z.boolean() })).max(20_000),
}).superRefine((data, ctx) => {
  for (const key of ["localities", "developers", "projects", "properties", "pois"] as const) {
    if (new Set(data[key].map(row => row.id)).size !== data[key].length) ctx.addIssue({ code: "custom", path: [key], message: "Duplicate catalog IDs." });
    if (key !== "pois" && new Set(data[key].map(row => row.slug)).size !== data[key].length) ctx.addIssue({ code: "custom", path: [key], message: "Duplicate catalog slugs." });
  }
  const localities = new Set(data.localities.map(row => row.id)), projects = new Set(data.projects.map(row => row.id)), developers = new Set(data.developers.map(row => row.id));
  data.localities.forEach((row, index) => { if (row.cityId !== data.city.id) ctx.addIssue({ code: "custom", path: ["localities", index], message: "Unknown city." }); });
  data.projects.forEach((row, index) => { if (!localities.has(row.localityId) || !developers.has(row.developerId) || row.priceMin > row.priceMax || row.unitsAvailable > row.unitsTotal) ctx.addIssue({ code: "custom", path: ["projects", index], message: "Invalid project relationships or ranges." }); });
  data.properties.forEach((row, index) => { if (!localities.has(row.localityId) || (row.projectId && !projects.has(row.projectId)) || (row.listingType === "rent" && !row.rentMonthly)) ctx.addIssue({ code: "custom", path: ["properties", index], message: "Invalid listing relationships or rent." }); });
});

export type Catalog = z.infer<typeof catalogSchema>;
