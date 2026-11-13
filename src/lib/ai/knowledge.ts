import "server-only";
import { getStore } from "@/lib/data/store";
import { AMENITIES } from "@/lib/data/developers";
import { localityIntelligence, nearbyPlaces } from "@/lib/data/repository";
import { formatArea, formatDistance, formatMinutes, formatPrice, formatPriceSqft, formatRent, projectStatusLabel } from "@/lib/format";
import type { Locality, PoiCategory, Project, Property } from "@/types";
import type { ToolContext } from "./tools";
import { OFFICIAL_SOURCES, SHOWCASE_NOTE, type AssistantSource } from "./sources";

export type GroundedAnswer = { text: string; sources: AssistantSource[] };
export const showcaseSource = (label: string, href: string): AssistantSource => ({ label, href, kind: "showcase" });
export const listedPrice = (p: Property) => p.listingType === "buy"
  ? formatPrice(p.price) : p.rentMonthly == null ? "Rent on request" : formatRent(p.rentMonthly);
export const amenityName = (slug: string) => AMENITIES.find((entry) => entry.slug === slug)?.name ?? slug;

const normalize = (value: string) => ` ${value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;

export function findLocalities(query: string): Locality[] {
  const q = normalize(query
    .replace(/\b(?:gachi\s*bowli|kachwali|kachiwali)\b/gi, "Gachibowli")
    .replace(/\b(?:hi[ -]?tech|hitec) city\b/gi, "Madhapur")
    .replace(/\b(?:financial dist|fin district)\b/gi, "Financial District"));
  return getStore().localities
    .filter(({ name }) => q.includes(normalize(name)))
    .sort((a, b) => q.indexOf(normalize(a.name)) - q.indexOf(normalize(b.name)));
}

export function findProjects(query: string): Project[] {
  const q = normalize(query);
  return getStore().projects
    .filter((p) => q.includes(normalize(p.name)) || q.includes(normalize(p.slug)))
    .sort((a, b) => b.name.length - a.name.length)
    .filter((p, i, matches) => !matches.slice(0, i).some((longer) => normalize(longer.name).includes(normalize(p.name))));
}

export function projectRecord(project: Project) {
  const store = getStore();
  const developer = store.developerById.get(project.developerId);
  const locality = store.localityById.get(project.localityId);
  const listings = store.propertiesByProject.get(project.id) ?? [];
  return {
    name: project.name, slug: project.slug,
    source: showcaseSource(project.name, `/project/${project.slug}`),
    dataNote: SHOWCASE_NOTE,
    builder: developer?.name, locality: locality?.name, summary: project.description,
    status: projectStatusLabel(project.status), listedPossession: project.possessionDate,
    priceRange: [project.priceMin, project.priceMax], configurations: project.configurations,
    towers: project.towers, floors: project.floors, units: project.unitsTotal, landAcres: project.landAreaAcres,
    amenities: project.amenities.map(amenityName),
    linkedSales: listings.filter((p) => p.listingType === "buy").length,
    linkedRentals: listings.filter((p) => p.listingType === "rent").length,
    reraCheck: OFFICIAL_SOURCES.rera,
    profile: project.profile ? {
      ...project.profile, reviews: undefined, floorPlans: project.profile.floorPlans?.slice(0, 6),
    } : null,
  };
}

export function listingRecord(property: Property) {
  const store = getStore();
  const project = property.projectId ? store.projectById.get(property.projectId) : undefined;
  return {
    id: property.id, title: property.title, slug: property.slug,
    source: showcaseSource(property.title, `/property/${property.slug}`),
    dataNote: SHOWCASE_NOTE, address: property.address, project: project?.name, projectSlug: project?.slug,
    listingType: property.listingType, type: property.propertyType, price: listedPrice(property),
    salePrice: property.listingType === "buy" ? property.price : null, monthlyRent: property.rentMonthly,
    maintenanceMonthly: property.maintenanceMonthly, deposit: property.deposit,
    builtupAreaSqft: property.builtupAreaSqft, carpetAreaSqft: property.carpetAreaSqft || null,
    superBuiltupAreaSqft: property.superBuiltupAreaSqft ?? null,
    bedrooms: property.bedrooms, bathrooms: property.bathrooms, parking: property.parking,
    floor: property.floor, totalFloors: property.totalFloors, facing: property.facing, furnishing: property.furnishing,
    possession: property.possession, amenities: property.amenities.map(amenityName),
    floorPlanUrl: property.floorPlanUrl, reraCheck: OFFICIAL_SOURCES.rera,
  };
}

export function officialGuidance(query: string): GroundedAnswer | null {
  const parts: string[] = [];
  const sources: AssistantSource[] = [];
  if (/\b(?:rera|registration number|promoter registration)\b/i.test(query)) {
    parts.push("**Project registration** — Search TG RERA using the project or promoter name from the builder’s documents, or the registration number on those documents. Match the project, promoter and phase in the official record. PropIT’s showcase RERA numbers cannot establish registration.");
    sources.push(OFFICIAL_SOURCES.rera);
  }
  if (/\b(?:encumbrance|stamp duty|registration fee|market value|guideline value|circle rate|government value|sale deed|title (?:check|clear|verification))\b/i.test(query)) {
    parts.push("**Registration and land records** — Check the property’s jurisdiction and identifiers through Telangana’s official services. Government registration values are a separate figure from PropIT’s showcase asking prices.");
    sources.push(OFFICIAL_SOURCES.registration, OFFICIAL_SOURCES.land);
  }
  if (/\b(?:zoning|land[ -]use|(?:hmda|hyderabad) master plan|road widening|layout approval|hmda approval|building permit)\b/i.test(query)) {
    parts.push("**Planning and land use** — Use HMDA’s applicable master plan and the property’s survey number to identify the relevant area. Confirm parcel-level land use and approvals with the relevant authority.");
    sources.push(OFFICIAL_SOURCES.planning);
  }
  if (/\bmetro\b/i.test(query) && /\b(?:proposed|phase\s*(?:ii|2)|future|extension|upcoming|operational|open(?:ed|ing)?|network|route map)\b/i.test(query)) {
    parts.push("**Hyderabad Metro** — Check the operator’s station and service list for operational routes. Use its official project updates for proposed routes and extensions. A planned station should not be counted as an operating stop when comparing commutes.");
    sources.push(OFFICIAL_SOURCES.metro);
  }
  return parts.length ? { text: parts.join("\n\n"), sources } : null;
}

export function compareLocalities(localities: Locality[]): GroundedAnswer {
  const stats = localities.slice(0, 4).map((locality) => localityIntelligence(locality.slug)!);
  const lines = stats.map(({ locality, stats }) => {
    const price = stats.medianPrice ? formatPrice(stats.medianPrice) : "unavailable";
    const rent = stats.avgRent ? formatRent(stats.avgRent) : "unavailable";
    return `· **${locality.name}** · ${formatPriceSqft(stats.avgPriceSqft)} modelled · Median asking price ${price} · Average asking rent ${rent} · ${stats.inventory} showcase listings`;
  });
  return {
    text: [stats.length > 1 ? "**Hyderabad locality comparison**" : `**${stats[0].locality.name} market snapshot**`,
      ...lines, ...(stats.length === 1 ? ["", stats[0].locality.summary,
        `Modelled yield ${stats[0].stats.rentalYieldPct}% · Modelled annual price change ${stats[0].stats.momentumPct}%`,
      ] : []),
      "", SHOWCASE_NOTE].join("\n"),
    sources: stats.map(({ locality }) => showcaseSource(locality.name, `/locality/${locality.slug}`)),
  };
}

export function compareListings(properties: Property[]): GroundedAnswer {
  const lines = properties.map((p) => `· **${p.title}** · ${p.listingType === "buy" ? "Sale" : "Rental"} · ${listedPrice(p)} · ${formatArea(p.builtupAreaSqft)} ${p.propertyType === "plot" ? "plot" : "built-up"}`);
  for (const mode of ["buy", "rent"] as const) {
    const comparable = properties.filter((p) => p.listingType === mode && (mode === "buy" || p.rentMonthly != null));
    const prices = comparable.map((p) => mode === "buy" ? p.price : p.rentMonthly!);
    if (prices.length > 1) {
      const delta = Math.max(...prices) - Math.min(...prices);
      lines.push(`· **${mode === "buy" ? "Sale price" : "Monthly rent"} spread** · ${delta ? formatPrice(delta, { compact: false }) : "Same amount"}`);
    }
  }
  const shared = properties[0]?.amenities.filter((amenity) => properties.every((p) => p.amenities.includes(amenity))) ?? [];
  if (shared.length) lines.push(`· **Shared listed amenities** · ${shared.map(amenityName).join(", ")}`);
  return {
    text: ["**Selected properties**", ...lines, "", SHOWCASE_NOTE].join("\n"),
    sources: properties.map((p) => showcaseSource(p.title, `/property/${p.slug}`)),
  };
}

function nearbyAnswer(label: string, origin: Project["location"], question: string, source: AssistantSource): GroundedAnswer {
  const categories: [RegExp, PoiCategory[]][] = [
    [/\b(?:metro|stations?|railway)\b/i, ["metro", "railway"]], [/\bschools?\b/i, ["school"]],
    [/\bhospitals?\b/i, ["hospital"]], [/\b(?:offices?|work|commute)\b/i, ["office_hub"]],
    [/\bairport\b/i, ["airport"]], [/\bparks?\b/i, ["park"]], [/\b(?:shopping|malls?)\b/i, ["mall"]],
  ];
  const requested = categories.flatMap(([re, values]) => re.test(question) ? values : []);
  const places = nearbyPlaces(origin, requested.length ? requested : ["metro", "school", "hospital", "office_hub", "park"], 12, requested.length ? 3 : 1, { verifiedOnly: true }).slice(0, 5);
  return {
    text: [`**Around ${label}**`, ...places.map((p) => `· ${p.name} · ${formatDistance(p.distanceKm)} · ~${formatMinutes(Math.max(1, p.minutes))} by car`),
      places.length ? "Drive times are distance-based estimates without traffic." : "I don’t have a matching mapped destination within 12 km.",
    ].join("\n"),
    sources: requested.includes("metro") ? [source, OFFICIAL_SOURCES.metro] : [source],
  };
}

export function lookupKnowledge(question: string, ctx: ToolContext): GroundedAnswer | null {
  const localities = findLocalities(question);
  const explicitProjects = findProjects(question);
  const store = getStore();
  const focusProject = ctx.projectSlug ? store.projectBySlug.get(ctx.projectSlug) : undefined;
  const searches = /\b(?:find|show me|search|looking for|under|below|switch to|only)\b/i.test(question);
  const project = explicitProjects[0] ?? (!localities.length && !searches ? focusProject : undefined);
  const nearby = /\b(?:nearby|metro|schools?|hospitals?|airport|commute|distance|parks?|malls?)\b/i.test(question);
  const namedArea = localities[0] ?? (ctx.localitySlug ? store.localityBySlug.get(ctx.localitySlug) : undefined);

  if (!searches && /\b(?:live|latest|current|today(?:’s|'s)?|transaction|actual)\b/i.test(question) &&
    /\b(?:prices?|rates?|rent|inventory|availability|market)\b/i.test(question)) {
    return {
      text: "I don’t have a live Hyderabad inventory or transaction feed. For government registration values, use Telangana’s official property services. I can show the asking prices and rents in PropIT’s showcase catalog.",
      sources: [OFFICIAL_SOURCES.registration, OFFICIAL_SOURCES.land],
    };
  }

  if (namedArea && !explicitProjects.length && (localities.length > 0 || !focusProject) && /\b(?:projects|developments|launches)\b/i.test(question)) {
    const area = namedArea;
    const projects = store.projects.filter((entry) => entry.localityId === area.id);
    const upcoming = /\b(?:new|upcoming|launches)\b/i.test(question);
    const results = projects.filter((entry) => !upcoming || entry.status === "new_launch" || entry.status === "upcoming");
    const sample = results.slice(0, 5);
    return {
      text: [
        "**" + area.name + " projects**",
        results.length ? results.length + " matching developments in the showcase catalog." : "The showcase catalog has no matching developments here.",
        ...sample.map((entry) => "· **" + entry.name + "** · " + projectStatusLabel(entry.status) + " · From " + formatPrice(entry.priceMin)),
        SHOWCASE_NOTE,
      ].join("\n"),
      sources: sample.map((entry) => showcaseSource(entry.name, "/project/" + entry.slug)),
    };
  }
  if (!searches && explicitProjects.length > 1) {
    const projects = explicitProjects.slice(0, 4).map(projectRecord);
    return {
      text: ["**Hyderabad project comparison**", ...projects.map((entry) =>
        `· **${entry.name}** · ${entry.locality ?? "Hyderabad"} · ${entry.builder ?? "Builder unavailable"} · From ${formatPrice(entry.priceRange[0])} · ${entry.status} · ${entry.listedPossession || "Possession date unavailable"}`
      ), "", SHOWCASE_NOTE].join("\n"),
      sources: projects.map((entry) => entry.source),
    };
  }
  if (!searches && localities.length > 1 && !project) return compareLocalities(localities);
  if (project && !searches) {
    const facts = projectRecord(project);
    if (nearby) return nearbyAnswer(project.name, project.location, question, facts.source);
    const amenities = /\b(?:amenities|clubhouse|pool|sports)\b/i.test(question);
    const documents = /\b(?:floor plans?|master plan|brochure|cost sheet|specifications?|video)\b/i.test(question);
    const lines = [`**${facts.name}** · ${facts.locality ?? "Hyderabad"}`];
    if (amenities) {
      lines.push(facts.amenities.length ? `Listed amenities: ${facts.amenities.join(", ")}.` : "The project record has no amenity list.");
      if (facts.profile?.clubhouseSqft) lines.push(`Clubhouse size: ${formatArea(facts.profile.clubhouseSqft)}.`);
    } else if (documents) {
      const available = [
        facts.profile?.brochureUrl && "brochure", facts.profile?.costSheetUrl && "cost sheet",
        facts.profile?.masterPlanUrl && "master plan", facts.profile?.floorPlans?.length && "floor plans",
        facts.profile?.specifications && "specifications", facts.profile?.videoUrl && "video",
      ].filter(Boolean);
      lines.push(available.length ? `The project page includes ${available.join(", ")}.` : "The project record has no plans, brochure, cost sheet, video or specifications on file.");
    } else {
      lines.push(`· **Builder** · ${facts.builder ?? "Unavailable"}`,
        `· **Showcase pricing** · ${formatPrice(project.priceMin)} to ${formatPrice(project.priceMax)}`,
        `· **Status and possession** · ${facts.status} · ${facts.listedPossession || "Date unavailable"}`,
        `· **Configurations** · ${facts.configurations.join(", ") || "Unavailable"}`,
        `· **Scale** · ${facts.towers} towers · ${facts.units} units · ${facts.landAcres} acres`,
        `· **Linked listings** · ${facts.linkedSales} for sale · ${facts.linkedRentals} for rent`);
    }
    return { text: [...lines, "", SHOWCASE_NOTE].join("\n"), sources: [facts.source] };
  }
  const locality = namedArea;
  if (locality && !searches && nearby && !ctx.propertyId && !/\bmy (?:office|school)\b/i.test(question)) {
    return nearbyAnswer(locality.name, locality.center, question, showcaseSource(locality.name, `/locality/${locality.slug}`));
  }
  if (locality && !searches && (localities.length || !ctx.propertyId) && /\b(?:market|trend|prices?|rent|yield|rates?|about|compare|good|investment)\b/i.test(question)) {
    return compareLocalities([locality]);
  }
  if (!searches && /\bhyderabad\b/i.test(question) && /\b(?:market|overview|coverage|inventory)\b/i.test(question)) {
    const buy = store.properties.filter((p) => p.listingType === "buy").length;
    return {
      text: [
        "**Hyderabad showcase coverage**",
        store.localities.length + " localities · " + store.projects.length + " projects · " + buy + " sale listings · " + (store.properties.length - buy) + " rentals.",
        "Ask for two localities to compare asking prices and rents, or name a project to see what information is on file.",
        SHOWCASE_NOTE,
      ].join("\n"),
      sources: [showcaseSource("Hyderabad localities", "/localities"), showcaseSource("Project catalog", "/projects")],
    };
  }
  return null;
}
