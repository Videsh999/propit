export type ListingType = "buy" | "rent";

export type PropertyType =
  | "apartment"
  | "villa"
  | "plot"
  | "independent_house"
  | "penthouse"
  | "farmhouse"
  | "commercial";

export type PossessionStatus =
  | "ready"
  | "within_6_months"
  | "within_1_year"
  | "under_construction";

export type ProjectStatus =
  | "new_launch"
  | "under_construction"
  | "ready"
  | "upcoming";

/** How much we trust a figure. Rendered differently everywhere it appears. */
export type DataQuality = "verified" | "listed" | "estimated";

export type PoiCategory =
  | "metro"
  | "school"
  | "hospital"
  | "office_hub"
  | "mall"
  | "park"
  | "stadium"
  | "airport"
  | "railway"
  | "restaurant"
  | "gym"
  | "temple";

export type AnchorKind = "office" | "school" | "family" | "gym" | "other";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface City {
  id: string;
  name: string;
  slug: string;
  center: LatLng;
  bounds: Bounds;
}

export interface Locality {
  id: string;
  cityId: string;
  name: string;
  slug: string;
  center: LatLng;
  /** Simplified boundary ring, [lng, lat][] */
  boundary: [number, number][];
  corridor: string;
  character: string;
  summary: string;
  avgPriceSqft: number;
  medianPrice: number;
  rentalYieldPct: number;
  momentumPct: number;
  inventoryCount: number;
  projectCount: number;
  heroImage: string;
  priceHistory: { year: number; priceSqft: number }[];
  dataQuality: DataQuality;
}

export interface Developer {
  id: string;
  name: string;
  slug: string;
  establishedYear: number;
  projectsDelivered: number;
  reraRegistered: boolean;
  about: string;
  logoMark: string;
}

export interface Project {
  id: string;
  developerId: string;
  localityId: string;
  name: string;
  slug: string;
  location: LatLng;
  status: ProjectStatus;
  possessionDate: string;
  reraNumber: string;
  reraVerified: boolean;
  priceMin: number;
  priceMax: number;
  unitsTotal: number;
  unitsAvailable: number;
  landAreaAcres: number;
  towers: number;
  floors: number;
  configurations: string[];
  description: string;
  heroImage: string;
  gallery: string[];
  amenities: string[];
  dataQuality: DataQuality;
}

export interface PropertyImage {
  url: string;
  roomTag: string;
}

export interface Property {
  id: string;
  slug: string;
  projectId: string | null;
  localityId: string;
  listingType: ListingType;
  propertyType: PropertyType;
  location: LatLng;
  title: string;
  address: string;

  price: number;
  pricePerSqft: number;
  rentMonthly: number | null;
  deposit: number | null;
  maintenanceMonthly: number;

  carpetAreaSqft: number;
  builtupAreaSqft: number;
  bedrooms: number;
  bathrooms: number;
  balconies: number;
  parking: number;
  floor: number;
  totalFloors: number;
  facing: string;
  furnishing: "unfurnished" | "semi_furnished" | "fully_furnished";
  ageYears: number;
  possession: PossessionStatus;
  availabilityDate: string;

  amenities: string[];
  images: PropertyImage[];
  description: string;

  isVerified: boolean;
  reraNumber: string | null;
  dataQuality: DataQuality;
  viewCount: number;
  createdAt: string;
}

export interface Poi {
  id: string;
  cityId: string;
  name: string;
  category: PoiCategory;
  subcategory: string;
  location: LatLng;
  rating: number | null;
  verified: boolean;
}

export interface Anchor {
  id: string;
  label: string;
  kind: AnchorKind;
  location: LatLng;
  address: string;
  /** Constraint expressed in km. Minutes are derived by the routing provider. */
  maxKm: number;
  /** 0.5 = nice to have, 1 = important, 2 = non-negotiable */
  weight: number;
}

export interface PropertyFilters {
  listingType: ListingType;
  propertyTypes: PropertyType[];
  bedrooms: number[];
  priceMin: number | null;
  priceMax: number | null;
  areaMin: number | null;
  areaMax: number | null;
  possession: PossessionStatus[];
  amenities: string[];
  localitySlugs: string[];
  verifiedOnly: boolean;
}

export interface FitBreakdown {
  anchorId: string;
  label: string;
  distanceKm: number;
  limitKm: number;
  minutes: number;
  score: number;
  weight: number;
}

export interface ScoredProperty extends Property {
  fitScore: number;
  fitBreakdown: FitBreakdown[];
  budgetFit: number;
  typeMatch: number;
}

export interface TravelLeg {
  distanceKm: number;
  minutes: number;
  /** true when derived from straight-line distance rather than a routing engine */
  estimated: boolean;
  mode: "drive";
}

export interface NearbyPlace extends Poi {
  distanceKm: number;
  minutes: number;
  estimated: boolean;
}

export interface Relaxation {
  kind: "anchor" | "budget" | "bedrooms" | "type";
  targetId: string | null;
  label: string;
  message: string;
  unlocked: number;
  patch: Record<string, unknown>;
}
