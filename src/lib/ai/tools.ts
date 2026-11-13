import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import {
  queryProperties,
  computeZone,
  localityIntelligence,
  nearbyPlaces,
  getPropertiesByIds,
  allLocalities,
} from "@/lib/data/repository";
import { getStore } from "@/lib/data/store";
import { getGeocodingProvider } from "@/lib/providers/geocoding";
import { HYDERABAD_MAX_BOUNDS } from "@/lib/map/viewport";
import { calcEmi, formatPriceSqft } from "@/lib/format";
import { filtersSchema } from "@/lib/api/schema";
import { findLocalities, findProjects, listedPrice, listingRecord, officialGuidance, projectRecord, showcaseSource } from "./knowledge";
import { OFFICIAL_SOURCES, SHOWCASE_NOTE, type AssistantSource } from "./sources";
import type { Anchor, PoiCategory, PropertyFilters } from "@/types";

/** A command the assistant issues to the client — this is how the AI drives the map. */
export interface ClientAction {
  type:
    | "set_filters"
    | "set_map_view"
    | "add_anchor"
    | "remove_anchor"
    | "clear_anchors"
    | "set_radius"
    | "clear_search_geometry"
    | "select_property"
    | "set_compare"
    | "toggle_layer";
  payload: Record<string, unknown>;
}

export interface ToolOutcome {
  /** What the model sees — facts only. */
  result: unknown;
  /** What the client applies — map/filter mutations. */
  actions: ClientAction[];
  /** Short human-readable status line rendered in the transcript. */
  status: string;
  sources?: AssistantSource[];
}

export const TOOL_DEFS: Anthropic.Tool[] = [
  {
    name: "get_listing_details",
    description: "Read a PropIT listing by ID or slug, or omit both for the selected listing. Returns sale or rent pricing, areas, costs, amenities, and related project. Read only.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" }, slug: { type: "string" } },
    },
  },
  {
    name: "find_projects",
    description: "Find PropIT projects by exact name or slug, or list up to six projects by locality. Omit inputs for the project currently open. Includes builder, plans, costs, stages and amenities when present. Results are showcase data.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" }, locality: { type: "string" } },
    },
  },
  {
    name: "official_verification_sources",
    description: "Get official Telangana source links and guidance for verifying registration, land use, stamp duty, and land records. This does not verify an individual property.",
    input_schema: {
      type: "object",
      properties: { question: { type: "string" } },
      required: ["question"],
    },
  },
  {
    name: "search_properties",
    description:
      "Search PropIT's Hyderabad showcase catalog. Use for explicit requests to find or filter listings. For research without changing the map, set updateMap to false. Counts and asking prices are illustrative.",
    input_schema: {
      type: "object",
      properties: {
        listingType: { type: "string", enum: ["buy", "rent"] },
        propertyTypes: {
          type: "array",
          items: {
            type: "string",
            enum: ["apartment", "villa", "plot", "independent_house", "penthouse", "farmhouse", "commercial"],
          },
        },
        bedrooms: { type: "array", items: { type: "number" }, description: "e.g. [3] for 3 BHK" },
        priceMin: { type: "number", description: "Rupees. 1 crore = 10000000." },
        priceMax: { type: "number", description: "Rupees. 2 crore = 20000000." },
        localitySlugs: { type: "array", items: { type: "string" } },
        possession: {
          type: "array",
          items: { type: "string", enum: ["ready", "within_6_months", "within_1_year", "under_construction"] },
        },
        amenities: { type: "array", items: { type: "string" } },
        nearPlace: { type: "string", description: "Place name to search around, e.g. 'Hitech City'." },
        radiusKm: { type: "number", description: "Radius around nearPlace, in km." },
        updateMap: { type: "boolean", description: "Set false for a read-only search." },
      },
    },
  },
  {
    name: "add_anchor",
    description:
      "Add one of the user's important places (office, school, family home, gym) to the map and constrain results to within a distance of it. This is PropIT's signature capability — use it whenever the user mentions where they work, study, or need to be near.",
    input_schema: {
      type: "object",
      properties: {
        label: { type: "string", description: "Short label, e.g. 'Office' or 'School'." },
        kind: { type: "string", enum: ["office", "school", "family", "gym", "other"] },
        place: { type: "string", description: "Place name to resolve, e.g. 'Financial District'." },
        maxKm: { type: "number", description: "Maximum acceptable distance in km. Default 5." },
        weight: { type: "number", description: "0.5 nice-to-have, 1 important, 2 non-negotiable." },
      },
      required: ["label", "kind", "place"],
    },
  },
  {
    name: "compute_livable_zone",
    description:
      "Compute the geographic area satisfying every anchor at once, and the homes inside it. Call after adding anchors. Returns the locality breakdown and, when nothing matches, concrete relaxation options.",
    input_schema: {
      type: "object",
      properties: {
        prioritise: { type: "string", description: "Optional anchor label to weight more heavily." },
      },
    },
  },
  {
    name: "remove_anchor",
    description: "Remove one of the user's anchors by its label.",
    input_schema: {
      type: "object",
      properties: { label: { type: "string" } },
      required: ["label"],
    },
  },
  {
    name: "set_map_view",
    description: "Move the map. Use a locality slug, or an explicit centre and zoom.",
    input_schema: {
      type: "object",
      properties: {
        localitySlug: { type: "string" },
        lat: { type: "number" },
        lng: { type: "number" },
        zoom: { type: "number" },
      },
    },
  },
  {
    name: "get_locality_intelligence",
    description:
      "Showcase statistics for a Hyderabad locality: asking prices, inventory, modelled yield and price history, and nearby mapped infrastructure. Accepts name or slug. Read only.",
    input_schema: {
      type: "object",
      properties: { slug: { type: "string", description: "Locality slug, e.g. 'kokapet'." } },
      required: ["slug"],
    },
  },
  {
    name: "list_localities",
    description: "List every locality PropIT covers, with slug, average price and inventory. Use to find the right slug.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_nearby",
    description:
      "What is near a place — schools, metro, hospitals, offices, parks, sports, shopping — with real distances.",
    input_schema: {
      type: "object",
      properties: {
        localitySlug: { type: "string" },
        propertyId: { type: "string" },
        categories: { type: "array", items: { type: "string" } },
        radiusKm: { type: "number" },
      },
    },
  },
  {
    name: "compare_properties",
    description: "Read up to four listings by ID for comparison. Omit ids for the user's comparison. Set updateComparison only when explicitly asked to change the comparison.",
    input_schema: {
      type: "object",
      properties: { ids: { type: "array", items: { type: "string" } }, updateComparison: { type: "boolean" } },
    },
  },
  {
    name: "estimate_emi",
    description: "Illustrative monthly EMI. Always present the output as an estimate, never as an offer.",
    input_schema: {
      type: "object",
      properties: {
        price: { type: "number" },
        downPaymentPct: { type: "number" },
        ratePct: { type: "number" },
        years: { type: "number" },
      },
      required: ["price"],
    },
  },
];

export interface ToolContext {
  filters: Partial<PropertyFilters>;
  anchors: Anchor[];
  /** What the user currently has open, so "here" and "this one" resolve. */
  localitySlug?: string | null;
  propertyId?: string | null;
  projectSlug?: string | null;
  comparisonIds?: string[];
}

async function resolveHyderabadPlace(name: string) {
  const store = getStore();
  const locality = findLocalities(name).find((area) => name.trim().toLowerCase() === area.name.toLowerCase());
  if (locality) return { name: locality.name, context: locality.name, location: locality.center };
  const places = await getGeocodingProvider().search(name, store.city.center, 6);
  const [west, south, east, north] = HYDERABAD_MAX_BOUNDS;
  return places.find(({ location: { lat, lng } }) => lat >= south && lat <= north && lng >= west && lng <= east);
}

export async function runTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  const store = getStore();

  switch (name) {
    case "get_listing_details": {
      const property = typeof input.slug === "string"
        ? store.propertyBySlug.get(input.slug)
        : store.propertyById.get(String(input.id ?? ctx.propertyId ?? ""));
      if (!property) return { result: { error: "No matching PropIT listing." }, actions: [], status: "" };
      const record = listingRecord(property);
      return { result: record, sources: [record.source], actions: [], status: "Read the selected listing" };
    }

    case "find_projects": {
      const locality = typeof input.locality === "string" ? findLocalities(input.locality)[0] : undefined;
      const matches = typeof input.query === "string" && input.query.trim()
        ? findProjects(input.query)
        : locality ? store.projects.filter((p) => p.localityId === locality.id)
          : ctx.projectSlug && !input.locality ? [store.projectBySlug.get(ctx.projectSlug)].filter((p) => !!p) : [];
      const records = matches.slice(0, 4).map(projectRecord);
      return { result: records.length ? records : { error: "No matching PropIT projects. Ask for the full name or try a locality." },
        sources: records.map((p) => p.source), actions: [], status: records.length ? "Looked up project details" : "" };
    }

    case "official_verification_sources": {
      const answer = officialGuidance(String(input.question ?? ""));
      return { result: answer?.text ?? "No applicable official guidance found.", sources: answer?.sources, actions: [], status: "" };
    }

    case "search_properties": {
      const nearPlace = typeof input.nearPlace === "string" ? input.nearPlace.trim().slice(0, 120) : undefined;
      const radiusKm = nearPlace ? Math.max(0.5, Math.min(40, Number(input.radiusKm) || 5)) : null;
      let center = null as { lat: number; lng: number } | null;
      let targetName = "";

      if (nearPlace) {
        const place = await resolveHyderabadPlace(nearPlace);
        if (place) {
          center = place.location;
          targetName = place.name;
        }
        if (!center) return { result: { error: `I couldn’t locate “${nearPlace}” in Hyderabad. Try the full name or a nearby locality.` }, actions: [], status: "" };
      }

      const parsed = filtersSchema.partial().safeParse(input);
      if (!parsed.success) return { result: { error: "Invalid property filters." }, actions: [], status: "" };
      // Zod applies inner defaults even for optional keys. Keep only fields the tool sent.
      const patch = Object.fromEntries(Object.entries(parsed.data).filter(([key]) => Object.hasOwn(input, key))) as Partial<PropertyFilters>;
      const update = input.updateMap !== false;
      const modeChanged = patch.listingType && patch.listingType !== (ctx.filters.listingType ?? "buy");
      const filters = { ...ctx.filters, ...(modeChanged ? { priceMin: null, priceMax: null } : {}),
        ...(center && !patch.localitySlugs?.length ? { localitySlugs: [] } : {}), ...patch };
      if (update) Object.assign(ctx.filters, filters);

      const res = queryProperties({
        filters,
        center: radiusKm ? center : null,
        radiusKm,
        anchors: ctx.anchors,
        limit: 8,
      });

      const actions: ClientAction[] = update ? [
        { type: "clear_search_geometry", payload: {} },
        { type: "set_filters", payload: filters },
      ] : [];
      if (update && center && radiusKm) {
        actions.push({ type: "set_radius", payload: { center, radiusKm, label: targetName } });
      } else if (update && filters.localitySlugs?.length) {
        actions.push({ type: "set_map_view", payload: { localitySlug: filters.localitySlugs[0] } });
      }

      return {
        result: {
          total: res.total,
          dataNote: SHOWCASE_NOTE,
          searchedAround: targetName || null,
          radiusKm,
          topResults: res.items.slice(0, 6).map((p) => ({
            id: p.id,
            slug: p.slug,
            title: p.title,
            locality: store.localityById.get(p.localityId)?.name,
            price: listedPrice(p),
            href: `/property/${p.slug}`,
            listingType: p.listingType,
            pricePerSqft: p.listingType === "buy" ? formatPriceSqft(p.pricePerSqft) : null,
            bedrooms: p.bedrooms,
            areaSqft: p.builtupAreaSqft,
            possession: p.possession,
            fitScore: ctx.anchors.length ? p.fitScore : null,
          })),
        },
        actions,
        sources: res.items.slice(0, 4).map((p) => showcaseSource(p.title, `/property/${p.slug}`)),
        status: `Found ${res.total} ${res.total === 1 ? "home" : "homes"}`,
      };
    }

    case "add_anchor": {
      if (ctx.anchors.length >= 6) return { result: { error: "Remove an anchor before adding another." }, actions: [], status: "" };
      const place = typeof input.place === "string" ? input.place.trim().slice(0, 120) : "";
      if (!place) return { result: { error: "A place name is required." }, actions: [], status: "" };
      const resolved = await resolveHyderabadPlace(place);
      if (!resolved) {
        return {
          result: { error: `Couldn't find a place called "${place}" in Hyderabad.` },
          actions: [],
          status: `Couldn't locate ${place}`,
        };
      }
      const anchor: Anchor = {
        id: `anchor_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        label: String(input.label ?? "Place").slice(0, 40),
        kind: (input.kind as Anchor["kind"]) ?? "other",
        location: resolved.location,
        address: (resolved.context || resolved.name).slice(0, 200),
        maxKm: Math.max(0.5, Math.min(40, Number(input.maxKm) || 5)),
        weight: (input.weight as number) ?? 1,
      };
      ctx.anchors.push(anchor);
      return {
        result: {
          added: { label: anchor.label, resolvedTo: resolved.name, maxKm: anchor.maxKm },
          totalAnchors: ctx.anchors.length,
        },
        actions: [{ type: "add_anchor", payload: anchor as unknown as Record<string, unknown> }],
        status: `Placed ${anchor.label} at ${resolved.name}`,
      };
    }

    case "remove_anchor": {
      const label = String(input.label).toLowerCase();
      const idx = ctx.anchors.findIndex((a) => a.label.toLowerCase() === label);
      if (idx === -1) {
        return { result: { error: "No anchor with that label." }, actions: [], status: "" };
      }
      const [removed] = ctx.anchors.splice(idx, 1);
      return {
        result: { removed: removed.label, remaining: ctx.anchors.length },
        actions: [{ type: "remove_anchor", payload: { id: removed.id } }],
        status: `Removed ${removed.label}`,
      };
    }

    case "compute_livable_zone": {
      const prioritise = input.prioritise as string | undefined;
      let anchors = ctx.anchors;
      const actions: ClientAction[] = [];
      if (prioritise) {
        const needle = prioritise.toLowerCase();
        anchors = ctx.anchors.map((a) =>
          a.label.toLowerCase().includes(needle) ? { ...a, weight: 2 } : { ...a, weight: 0.75 },
        );
        ctx.anchors.splice(0, ctx.anchors.length, ...anchors);
        actions.push({ type: "clear_anchors", payload: {} });
        for (const a of anchors) {
          actions.push({ type: "add_anchor", payload: a as unknown as Record<string, unknown> });
        }
      }
      const zone = computeZone(anchors, ctx.filters, 8);
      return {
        result: {
          total: zone.total,
          dataNote: SHOWCASE_NOTE,
          areaKm2: zone.areaKm2,
          routingIsEstimate: zone.routingIsEstimate,
          bestLocalities: zone.localityBreakdown,
          relaxationOptions: zone.relaxations.map((r) => ({
            label: r.label,
            unlocks: r.unlocked,
            message: r.message,
          })),
          topMatches: zone.items.slice(0, 6).map((p) => ({
            id: p.id,
            title: p.title,
            locality: store.localityById.get(p.localityId)?.name,
            price: listedPrice(p),
            fitScore: p.fitScore,
            bedrooms: p.bedrooms,
            areaSqft: p.builtupAreaSqft,
          })),
        },
        actions,
        sources: zone.items.slice(0, 4).map((p) => showcaseSource(p.title, `/property/${p.slug}`)),
        status: `${zone.total} ${zone.total === 1 ? "home" : "homes"} in the livable zone`,
      };
    }

    case "set_map_view": {
      const slug = input.localitySlug as string | undefined;
      if (slug) {
        const l = store.localityBySlug.get(slug);
        if (!l) return { result: { error: "Unknown locality." }, actions: [], status: "" };
        return {
          result: { movedTo: l.name },
          actions: [{ type: "set_map_view", payload: { localitySlug: slug } }],
          status: `Moved the map to ${l.name}`,
        };
      }
      const lat = input.lat as number;
      const lng = input.lng as number;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { result: { error: "Need a locality slug or coordinates." }, actions: [], status: "" };
      }
      return {
        result: { movedTo: { lat, lng } },
        actions: [{ type: "set_map_view", payload: { lat, lng, zoom: input.zoom ?? 13 } }],
        status: "Moved the map",
      };
    }

    case "get_locality_intelligence": {
      const slug = String(input.slug ?? ctx.localitySlug ?? "");
      const data = localityIntelligence(slug) ?? localityIntelligence(findLocalities(slug)[0]?.slug ?? "");
      if (!data) {
        return {
          result: { error: `No locality with slug "${input.slug}". Call list_localities first.` },
          actions: [],
          status: "",
        };
      }
      return {
        result: {
          name: data.locality.name,
          dataNote: SHOWCASE_NOTE,
          corridor: data.locality.corridor,
          character: data.locality.character,
          summary: data.locality.summary,
          avgPriceSqft: data.stats.avgPriceSqft,
          medianPrice: data.stats.medianPrice,
          priceRange: data.stats.priceRange,
          inventory: data.stats.inventory,
          projects: data.stats.projects,
          rentalYieldPct: data.stats.rentalYieldPct,
          momentumPct: data.stats.momentumPct,
          avgRent: data.stats.avgRent,
          priceHistory: data.priceHistory,
          connectivity: data.connectivity.map((c) => ({
            name: c.name,
            category: c.category,
            distanceKm: c.distanceKm,
            minutes: c.minutes,
            estimated: c.estimated,
          })),
          topProjects: data.topProjects.map((p) => ({
            name: p.name,
            status: p.status,
            priceMin: p.priceMin,
            slug: p.slug,
          })),
        },
        actions: [],
        sources: [showcaseSource(data.locality.name, `/locality/${data.locality.slug}`)],
        status: `Pulled data for ${data.locality.name}`,
      };
    }

    case "list_localities": {
      return {
        result: { dataNote: SHOWCASE_NOTE, localities: allLocalities().map((l) => ({
          slug: l.slug,
          name: l.name,
          corridor: l.corridor,
          avgPriceSqft: l.avgPriceSqft,
          inventory: l.inventoryCount,
          momentumPct: l.momentumPct,
          rentalYieldPct: l.rentalYieldPct,
        })) },
        actions: [],
        status: "",
      };
    }

    case "get_nearby": {
      let center = null as { lat: number; lng: number } | null;
      let label = "";
      if (input.localitySlug) {
        const l = store.localityBySlug.get(input.localitySlug as string);
        if (l) {
          center = l.center;
          label = l.name;
        }
      } else if (input.propertyId) {
        const p = store.propertyById.get(input.propertyId as string);
        if (p) {
          center = p.location;
          label = p.title;
        }
      }
      if (!center && !input.localitySlug && !input.propertyId) {
        const property = store.propertyById.get(ctx.propertyId ?? "");
        const project = store.projectBySlug.get(ctx.projectSlug ?? "");
        const locality = store.localityBySlug.get(ctx.localitySlug ?? "");
        center = property?.location ?? project?.location ?? locality?.center ?? null;
        label = property?.title ?? project?.name ?? locality?.name ?? "";
      }
      if (!center) return { result: { error: "Couldn't resolve that location." }, actions: [], status: "" };
      const cats = Array.isArray(input.categories) ? input.categories as PoiCategory[] : [];
      const radius = Math.max(0.5, Math.min(40, Number(input.radiusKm) || 6));
      const places = nearbyPlaces(center, cats.length ? cats : null, radius, 3, { verifiedOnly: true }).slice(0, 12);
      return {
        result: {
          around: label,
          places: places.map((p) => ({
            name: p.name,
            category: p.category,
            subcategory: p.subcategory,
            distanceKm: p.distanceKm,
            minutes: p.minutes,
            travelTimeIsEstimated: p.estimated,
            verified: p.verified,
          })),
        },
        actions: [],
        sources: cats.includes("metro") ? [OFFICIAL_SOURCES.metro] : [],
        status: `Checked what's near ${label}`,
      };
    }

    case "compare_properties": {
      const ids = [...new Set((Array.isArray(input.ids) ? input.ids.filter((id): id is string => typeof id === "string") : ctx.comparisonIds ?? []))].slice(0, 4);
      const props = getPropertiesByIds(ids);
      if (!props.length) return { result: { error: "None of those ids exist." }, actions: [], status: "" };
      const records = props.map(listingRecord);
      return {
        result: records,
        actions: input.updateComparison === true && props.length === ids.length ? [{ type: "set_compare", payload: { ids } }] : [],
        sources: records.map((p) => p.source),
        status: `Compared ${props.length} homes`,
      };
    }

    case "estimate_emi": {
      const price = input.price as number;
      const downPct = (input.downPaymentPct as number) ?? 20;
      const rate = (input.ratePct as number) ?? 8.6;
      const years = (input.years as number) ?? 20;
      if (![price, downPct, rate, years].every(Number.isFinite) || price <= 0 || downPct < 0 || downPct > 100 || rate < 0 || rate > 40 || years < 1 || years > 40) {
        return { result: { error: "Enter a valid price, down payment, annual rate and loan term." }, actions: [], status: "" };
      }
      const principal = price * (1 - downPct / 100);
      return {
        result: {
          principal,
          monthlyEmi: Math.round(calcEmi(principal, rate, years)),
          downPayment: Math.round(price * (downPct / 100)),
          ratePct: rate,
          years,
          disclaimer:
            "Illustrative only. Not an offer of credit and not financial advice — actual rates and eligibility vary by lender.",
        },
        actions: [],
        status: "Calculated an illustrative EMI",
      };
    }

    default:
      return { result: { error: `Unknown tool ${name}` }, actions: [], status: "" };
  }
}

export function systemPrompt(): string {
  return `You are PropIT's real estate concierge for Hyderabad, India.

PropIT is a map-first property discovery platform. Its signature capability is finding homes that sit between the places that matter in someone's life - their office, their child's school, their parents - rather than making them scroll a list.

## Grounding rules - these are absolute

- Every factual claim you make MUST come from a tool result in this conversation. If you have not called a tool, you do not know the answer.
- NEVER invent or estimate a price, area, RERA number, possession date, availability, or address. If a tool did not return it, say you don't have it.
- PropIT's catalog is showcase data. Label its listings, prices, availability and locality statistics as illustrative. Never claim live market coverage, a real sale price, official approval, title status, or independently verified registration.
- Nearby and locality tools use straight-line distances and modelled travel times. Call those estimates without traffic.
- For RERA, land records, land use or registration use official_verification_sources. Explain how to check the source and never claim the registry has been queried for the property.
- The app attaches source links from tool results. Do not invent URLs or cite a source you did not use.
- You are not a financial adviser. EMI figures are illustrative. Never present a purchase as a guaranteed investment.
- Recommendations and comparisons are your judgement - phrase them as such, not as fact.

## How to work

- Use get_listing_details and find_projects for follow-ups about the listing or project currently open. Use compare_properties with no ids for the current comparison.
- Update the map or shortlist only for explicit search or action requests. For informational questions use read-only lookups.
- When someone provides a location to anchor their search, call add_anchor. Never infer an anchor from a factual question about a locality.
- After adding anchors, call compute_livable_zone.
- When zero homes match, never stop at "nothing found". compute_livable_zone returns concrete relaxation options; offer the strongest one with its real number.
- Use list_localities to find slugs. Never guess a slug.
- Prices are in rupees: 1 crore = 10,000,000; 1 lakh = 100,000.

## Voice

Warm, precise, economical. Short paragraphs. No bullet-point dumps unless comparing. No exclamation marks. Never say "I'd be happy to". Sound like a knowledgeable person who respects the reader's time. End with one useful next step, phrased as a question, when it genuinely helps.`;
}
