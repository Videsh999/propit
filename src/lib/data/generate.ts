import type {
  Locality,
  PossessionStatus,
  Project,
  ProjectStatus,
  Property,
  PropertyType,
} from "@/types";
import { LOCALITIES } from "./localities";
import { DEVELOPERS } from "./developers";
import { AMENITIES } from "./developers";
import { imageSet, heroImage } from "./images";
import { mulberry32, hashString, slugify, clamp } from "@/lib/utils";
import { randomPointInRing } from "@/lib/geo/spatial";

const PROJECT_PREFIX = [
  "Aurelia", "Vantage", "Serene", "The Vista", "Elmwood", "Skyward", "Casa", "Aranya",
  "Meridian", "Palladio", "Nirvana", "Solstice", "Verdant", "Amara", "The Quarry",
  "Highgrove", "Lumen", "Ivory", "Crest", "Silverleaf", "Tranquil", "Aeris",
  "Grand", "Orchid", "Sapphire", "Zenith", "Willow", "Astoria", "Vaastu", "Emerald",
];
const PROJECT_SUFFIX = [
  "Heights", "Residences", "Enclave", "Gardens", "Towers", "Park", "Grove",
  "Estate", "Terraces", "Court", "Springs", "Boulevard", "Sanctuary", "Pavilion",
];

const FACINGS = ["East", "West", "North", "South", "North-East", "South-East", "North-West"];

const TYPE_MIX: { type: PropertyType; weight: number; priceMult: number }[] = [
  { type: "apartment", weight: 0.6, priceMult: 1 },
  { type: "villa", weight: 0.16, priceMult: 1.32 },
  { type: "independent_house", weight: 0.09, priceMult: 1.14 },
  { type: "plot", weight: 0.07, priceMult: 0.62 },
  { type: "penthouse", weight: 0.04, priceMult: 1.85 },
  { type: "commercial", weight: 0.03, priceMult: 1.45 },
  { type: "farmhouse", weight: 0.01, priceMult: 1.6 },
];

function pickWeighted(rnd: () => number) {
  const r = rnd();
  let acc = 0;
  for (const t of TYPE_MIX) {
    acc += t.weight;
    if (r <= acc) return t;
  }
  return TYPE_MIX[0];
}

function bedroomsFor(type: PropertyType, rnd: () => number): number {
  if (type === "plot" || type === "commercial") return 0;
  if (type === "penthouse") return rnd() < 0.5 ? 4 : 5;
  if (type === "villa" || type === "farmhouse") return rnd() < 0.55 ? 4 : rnd() < 0.8 ? 3 : 5;
  const r = rnd();
  if (r < 0.06) return 1;
  if (r < 0.34) return 2;
  if (r < 0.78) return 3;
  if (r < 0.94) return 4;
  return 5;
}

function areaFor(type: PropertyType, beds: number, rnd: () => number): number {
  const jitter = 0.9 + rnd() * 0.24;
  if (type === "plot") return Math.round((1200 + rnd() * 3600) * jitter);
  if (type === "commercial") return Math.round((800 + rnd() * 4200) * jitter);
  if (type === "farmhouse") return Math.round((3200 + rnd() * 3000) * jitter);
  if (type === "villa") return Math.round((2100 + beds * 480) * jitter);
  if (type === "penthouse") return Math.round((3000 + beds * 420) * jitter);
  if (type === "independent_house") return Math.round((1500 + beds * 420) * jitter);
  const base = [420, 680, 1150, 1620, 2150, 2750][clamp(beds, 0, 5)];
  return Math.round(base * jitter);
}

const POSSESSIONS: PossessionStatus[] = [
  "ready",
  "within_6_months",
  "within_1_year",
  "under_construction",
];
const PROJECT_STATUSES: ProjectStatus[] = [
  "new_launch",
  "under_construction",
  "ready",
  "upcoming",
];

function projectCountFor(loc: Locality, rnd: () => number): number {
  const momentumBoost = loc.momentumPct > 11 ? 2 : loc.momentumPct > 7 ? 1 : 0;
  return 1 + momentumBoost + (rnd() < 0.45 ? 1 : 0);
}

function propertyCountFor(loc: Locality, rnd: () => number): number {
  // Denser inventory where prices are mid-market and momentum is high.
  const base = loc.avgPriceSqft > 13000 ? 12 : loc.avgPriceSqft > 9000 ? 24 : 28;
  return Math.round(base * (0.75 + rnd() * 0.7));
}

export interface GeneratedData {
  projects: Project[];
  properties: Property[];
  localities: Locality[];
}

export function generate(): GeneratedData {
  const projects: Project[] = [];
  const properties: Property[] = [];
  const localities: Locality[] = LOCALITIES.map((l) => ({ ...l }));
  const usedSlugs = new Set<string>();

  for (const loc of localities) {
    const rnd = mulberry32(hashString("gen:" + loc.slug));

    // ---- Projects -------------------------------------------------------
    const nProjects = projectCountFor(loc, rnd);
    const localProjects: Project[] = [];

    for (let i = 0; i < nProjects; i++) {
      const dev = DEVELOPERS[Math.floor(rnd() * DEVELOPERS.length)];
      let name = `${PROJECT_PREFIX[Math.floor(rnd() * PROJECT_PREFIX.length)]} ${
        PROJECT_SUFFIX[Math.floor(rnd() * PROJECT_SUFFIX.length)]
      }`;
      let slug = slugify(name);
      if (usedSlugs.has(slug)) {
        name = `${name} ${loc.name}`;
        slug = slugify(name);
      }
      usedSlugs.add(slug);

      const pt = randomPointInRing(loc.boundary, rnd) ?? loc.center;
      const status = PROJECT_STATUSES[Math.floor(rnd() * PROJECT_STATUSES.length)];
      const seed = hashString(slug);
      const baseSqft = loc.avgPriceSqft * (0.92 + rnd() * 0.22);
      const configs = (["2 BHK", "3 BHK", "4 BHK"] as const).filter(() => rnd() > 0.25);
      const amenityCount = 6 + Math.floor(rnd() * 8);
      const amenities = [...AMENITIES]
        .sort(() => rnd() - 0.5)
        .slice(0, amenityCount)
        .map((a) => a.slug);

      const priceMin = Math.round((baseSqft * (900 + rnd() * 400)) / 100000) * 100000;
      const priceMax = Math.round((priceMin * (1.6 + rnd() * 1.1)) / 100000) * 100000;
      const possessionYear = status === "ready" ? 2025 : 2026 + Math.floor(rnd() * 3);

      const project: Project = {
        id: `prj_${slug}`,
        developerId: dev.id,
        localityId: loc.id,
        name,
        slug,
        location: pt,
        status,
        possessionDate: `${["Mar", "Jun", "Sep", "Dec"][Math.floor(rnd() * 4)]} ${possessionYear}`,
        reraNumber: `P02400${String(1000 + Math.floor(rnd() * 8999))}`,
        reraVerified: rnd() > 0.18,
        priceMin,
        priceMax,
        unitsTotal: 120 + Math.floor(rnd() * 680),
        unitsAvailable: 0,
        landAreaAcres: Math.round((2 + rnd() * 18) * 10) / 10,
        towers: 2 + Math.floor(rnd() * 9),
        floors: status === "ready" ? 12 + Math.floor(rnd() * 20) : 15 + Math.floor(rnd() * 25),
        configurations: configs.length ? [...configs] : ["3 BHK"],
        description: (() => {
          // Preserve the seed sequence so existing project and listing URLs stay stable.
          rnd();
          rnd();
          rnd();
          return `${name} is a development by ${dev.name} in ${loc.name}. ${loc.character}.`;
        })(),
        heroImage: heroImage(seed),
        gallery: imageSet(seed, 6).map((g) => g.url),
        amenities,
        dataQuality: rnd() > 0.3 ? "verified" : "listed",
      };
      project.unitsAvailable = Math.round(project.unitsTotal * (0.08 + rnd() * 0.45));
      projects.push(project);
      localProjects.push(project);
    }

    // ---- Properties -----------------------------------------------------
    const nProps = propertyCountFor(loc, rnd);
    const prices: number[] = [];

    for (let i = 0; i < nProps; i++) {
      const inProject = localProjects.length > 0 && rnd() < 0.62;
      const project = inProject
        ? localProjects[Math.floor(rnd() * localProjects.length)]
        : null;

      // Project units sit on the project's footprint; standalone stock scatters.
      let location;
      if (project) {
        const jitter = 0.0016;
        location = {
          lat: project.location.lat + (rnd() - 0.5) * jitter,
          lng: project.location.lng + (rnd() - 0.5) * jitter,
        };
      } else {
        location = randomPointInRing(loc.boundary, rnd) ?? loc.center;
      }

      const typeInfo = pickWeighted(rnd);
      const type = typeInfo.type;
      const beds = bedroomsFor(type, rnd);
      const builtup = areaFor(type, beds, rnd);
      const carpet = Math.round(builtup * (0.68 + rnd() * 0.12));

      const listingType = rnd() < 0.22 ? "rent" : "buy";
      const sqftRate = Math.round(
        loc.avgPriceSqft * typeInfo.priceMult * (0.88 + rnd() * 0.26),
      );
      const price = Math.round((sqftRate * builtup) / 50000) * 50000;
      const rentMonthly =
        listingType === "rent"
          ? Math.round(((price * (loc.rentalYieldPct / 100)) / 12 / 500) * 500)
          : null;

      const totalFloors = project ? project.floors : 4 + Math.floor(rnd() * 16);
      const floor =
        type === "villa" || type === "plot" || type === "farmhouse" || type === "independent_house"
          ? 0
          : 1 + Math.floor(rnd() * totalFloors);

      const possession: PossessionStatus = project
        ? project.status === "ready"
          ? "ready"
          : project.status === "under_construction"
            ? rnd() < 0.5
              ? "within_1_year"
              : "under_construction"
            : "under_construction"
        : POSSESSIONS[Math.floor(rnd() * POSSESSIONS.length)];

      const seed = hashString(`${loc.slug}:${i}`);
      const slug = `${slugify(
        `${beds ? beds + "-bhk" : type} ${type} ${loc.name}`,
      )}-${seed.toString(36).slice(0, 5)}`;

      const amenities = project
        ? project.amenities.slice(0, 5 + Math.floor(rnd() * 6))
        : [...AMENITIES].sort(() => rnd() - 0.5).slice(0, 3 + Math.floor(rnd() * 5)).map((a) => a.slug);

      const title =
        type === "plot"
          ? `${builtup} sq.ft Residential Plot in ${loc.name}`
          : type === "commercial"
            ? `Commercial Space in ${loc.name}`
            : `${beds ? beds + " BHK " : ""}${
                type === "apartment"
                  ? rnd() > 0.5
                    ? "Apartment"
                    : "Residence"
                  : type === "villa"
                    ? "Villa"
                    : type === "penthouse"
                      ? "Penthouse"
                      : type === "farmhouse"
                        ? "Farmhouse"
                        : "Independent House"
              }${project ? ` at ${project.name}` : ""}`;

      const isLand = type === "plot" || type === "commercial";
      const isVerified = rnd() > 0.32;

      properties.push({
        id: `prop_${slug}`,
        slug,
        projectId: project?.id ?? null,
        localityId: loc.id,
        listingType,
        propertyType: type,
        location,
        title,
        address: `${
          project ? project.name + ", " : ""
        }${loc.name}, ${loc.corridor.split("·")[0].trim()} Hyderabad`,
        price,
        pricePerSqft: sqftRate,
        rentMonthly,
        deposit: rentMonthly ? rentMonthly * (rnd() < 0.5 ? 6 : 10) : null,
        maintenanceMonthly: Math.round((builtup * (2.2 + rnd() * 2.4)) / 100) * 100,
        carpetAreaSqft: carpet,
        builtupAreaSqft: builtup,
        bedrooms: beds,
        // Land and commercial shells have no bedrooms, baths or allotted parking.
        bathrooms: isLand ? 0 : beds === 0 ? 1 : Math.max(1, beds - (rnd() < 0.4 ? 1 : 0)),
        balconies: isLand || beds === 0 ? 0 : 1 + Math.floor(rnd() * 2),
        parking: isLand ? 0 : type === "villa" || type === "penthouse" ? 2 : rnd() < 0.75 ? 1 : 2,
        floor,
        totalFloors,
        facing: FACINGS[Math.floor(rnd() * FACINGS.length)],
        furnishing:
          listingType === "rent"
            ? (["semi_furnished", "fully_furnished", "unfurnished"] as const)[
                Math.floor(rnd() * 3)
              ]
            : "unfurnished",
        ageYears: possession === "ready" ? Math.floor(rnd() * 8) : 0,
        possession,
        availabilityDate: possession === "ready" ? "Immediate" : `${2026 + Math.floor(rnd() * 3)}`,
        amenities,
        images: imageSet(seed, 5),
        description: (() => {
          // Keep the seed sequence stable for existing listing URLs and inventory.
          rnd();
          return project ? `Part of ${project.name} in ${loc.name}. ${loc.character}.` : loc.character + ".";
        })(),
        isVerified,
        reraNumber: project?.reraNumber ?? (rnd() > 0.6 ? `P02400${String(1000 + Math.floor(rnd() * 8999))}` : null),
        dataQuality: isVerified ? "verified" : "listed",
        viewCount: Math.floor(rnd() * 2400),
        createdAt: new Date(
          Date.UTC(2026, Math.floor(rnd() * 9), 1 + Math.floor(rnd() * 27)),
        ).toISOString(),
      });

      if (listingType === "buy") prices.push(price);
    }

    prices.sort((a, b) => a - b);
    loc.medianPrice = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
    loc.inventoryCount = nProps;
    loc.projectCount = localProjects.length;
    loc.dataQuality = "estimated";
  }

  return { projects, properties, localities };
}
