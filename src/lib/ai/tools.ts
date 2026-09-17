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
import { getRoutingProvider } from "@/lib/providers/routing";
import { calcEmi, formatPrice, formatPriceSqft } from "@/lib/format";
import type { Anchor, PropertyFilters } from "@/types";

/** A command the assistant issues to the client — this is how the AI drives the map. */
export interface ClientAction {
  type:
    | "set_filters"
    | "set_map_view"
    | "add_anchor"
    | "remove_anchor"
    | "clear_anchors"
    | "set_radius"
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
}

export const TOOL_DEFS: Anthropic.Tool[] = [
  {
    name: "search_properties",
    description:
      "Search PropIT's property inventory and update the map. Use for any request to find, show, or filter homes. Returns real counts and listings from the database.",
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
      "Real statistics for one locality: pricing, inventory, yield, momentum, price history, connectivity and nearby infrastructure. Use before making any claim about an area.",
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
    description: "Pull full details for up to four properties by id so they can be compared side by side.",
    input_schema: {
      type: "object",
      properties: { ids: { type: "array", items: { type: "string" } } },
      required: ["ids"],
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
}

export async function runTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  const store = getStore();

  switch (name) {
    case "search_properties": {
      const nearPlace = input.nearPlace as string | undefined;
      const radiusKm = (input.radiusKm as number | undefined) ?? null;
      let center = null as { lat: number; lng: number } | null;
      let targetName = "";

      if (nearPlace) {
        const places = await getGeocodingProvider().search(nearPlace, store.city.center, 1);
        if (places[0]) {
          center = places[0].location;
          targetName = places[0].name;
        }
      }

      const filters: Partial<PropertyFilters> = {
        ...ctx.filters,
        ...(input.listingType ? { listingType: input.listingType as "buy" | "rent" } : {}),
        ...(input.propertyTypes ? { propertyTypes: input.propertyTypes as never } : {}),
        ...(input.bedrooms ? { bedrooms: input.bedrooms as number[] } : {}),
        ...(input.priceMin != null ? { priceMin: input.priceMin as number } : {}),
        ...(input.priceMax != null ? { priceMax: input.priceMax as number } : {}),
        ...(input.localitySlugs ? { localitySlugs: input.localitySlugs as string[] } : {}),
        ...(input.possession ? { possession: input.possession as never } : {}),
        ...(input.amenities ? { amenities: input.amenities as string[] } : {}),
      };
      Object.assign(ctx.filters, filters);

      const res = queryProperties({
        filters,
        center: radiusKm ? center : null,
        radiusKm,
        anchors: ctx.anchors,
        limit: 8,
      });

      const actions: ClientAction[] = [{ type: "set_filters", payload: filters }];
      if (center && radiusKm) {
        actions.push({ type: "set_radius", payload: { center, radiusKm, label: targetName } });
      } else if (filters.localitySlugs?.length) {
        actions.push({ type: "set_map_view", payload: { localitySlug: filters.localitySlugs[0] } });
      }

      return {
        result: {
          total: res.total,
          searchedAround: targetName || null,
          radiusKm,
          topResults: res.items.map((p) => ({
            id: p.id,
            slug: p.slug,
            title: p.title,
            locality: store.localityById.get(p.localityId)?.name,
            price: formatPrice(p.price),
            priceRaw: p.price,
            pricePerSqft: formatPriceSqft(p.pricePerSqft),
            bedrooms: p.bedrooms,
            areaSqft: p.builtupAreaSqft,
            possession: p.possession,
            verified: p.isVerified,
            dataQuality: p.dataQuality,
            fitScore: ctx.anchors.length ? p.fitScore : null,
          })),
        },
        actions,
        status: `Found ${res.total} ${res.total === 1 ? "home" : "homes"}`,
      };
    }

    case "add_anchor": {
      const place = input.place as string;
      const places = await getGeocodingProvider().search(place, store.city.center, 1);
      if (!places[0]) {
        return {
          result: { error: `Couldn't find a place called "${place}" in Hyderabad.` },
          actions: [],
          status: `Couldn't locate ${place}`,
        };
      }
      const anchor: Anchor = {
        id: `anchor_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        label: input.label as string,
        kind: (input.kind as Anchor["kind"]) ?? "other",
        location: places[0].location,
        address: places[0].context || places[0].name,
        maxKm: (input.maxKm as number) ?? 5,
        weight: (input.weight as number) ?? 1,
      };
      ctx.anchors.push(anchor);
      return {
        result: {
          added: { label: anchor.label, resolvedTo: places[0].name, maxKm: anchor.maxKm },
          totalAnchors: ctx.anchors.length,
        },
        actions: [{ type: "add_anchor", payload: anchor as unknown as Record<string, unknown> }],
        status: `Placed ${anchor.label} at ${places[0].name}`,
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
            price: formatPrice(p.price),
            fitScore: p.fitScore,
            bedrooms: p.bedrooms,
            areaSqft: p.builtupAreaSqft,
          })),
        },
        actions,
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
      const data = localityIntelligence(input.slug as string);
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
          dataQuality: data.locality.dataQuality,
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
            reraVerified: p.reraVerified,
          })),
        },
        actions: [{ type: "set_map_view", payload: { localitySlug: data.locality.slug } }],
        status: `Pulled data for ${data.locality.name}`,
      };
    }

    case "list_localities": {
      return {
        result: allLocalities().map((l) => ({
          slug: l.slug,
          name: l.name,
          corridor: l.corridor,
          avgPriceSqft: l.avgPriceSqft,
          inventory: l.inventoryCount,
          momentumPct: l.momentumPct,
          rentalYieldPct: l.rentalYieldPct,
        })),
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
      if (!center) return { result: { error: "Couldn't resolve that location." }, actions: [], status: "" };
      const cats = (input.categories as string[] | undefined) ?? [];
      const places = nearbyPlaces(center, cats.length ? (cats as never) : null, (input.radiusKm as number) ?? 6, 3);
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
        status: `Checked what's near ${label}`,
      };
    }

    case "compare_properties": {
      const ids = (input.ids as string[]).slice(0, 4);
      const props = getPropertiesByIds(ids);
      if (!props.length) return { result: { error: "None of those ids exist." }, actions: [], status: "" };
      return {
        result: props.map((p) => ({
          id: p.id,
          title: p.title,
          locality: store.localityById.get(p.localityId)?.name,
          price: p.price,
          priceFormatted: formatPrice(p.price),
          pricePerSqft: p.pricePerSqft,
          areaSqft: p.builtupAreaSqft,
          carpetSqft: p.carpetAreaSqft,
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          parking: p.parking,
          possession: p.possession,
          amenities: p.amenities,
          maintenanceMonthly: p.maintenanceMonthly,
          verified: p.isVerified,
          reraNumber: p.reraNumber,
          dataQuality: p.dataQuality,
        })),
        actions: [{ type: "set_compare", payload: { ids } }],
        status: `Compared ${props.length} homes`,
      };
    }

    case "estimate_emi": {
      const price = input.price as number;
      const downPct = (input.downPaymentPct as number) ?? 20;
      const rate = (input.ratePct as number) ?? 8.6;
      const years = (input.years as number) ?? 20;
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
  const routing = getRoutingProvider();
  return `You are PropIT's real-estate concierge for Hyderabad, India.

PropIT is a map-first property discovery platform. Its signature capability is finding homes that sit between the places that matter in someone's life - their office, their child's school, their parents - rather than making them scroll a list.

## Grounding rules - these are absolute

- Every factual claim you make MUST come from a tool result in this conversation. If you have not called a tool, you do not know the answer.
- NEVER invent or estimate a price, area, RERA number, possession date, availability, or address. If a tool did not return it, say you don't have it.
- Tool results tag data as verified, listed, or estimated. Reflect that in your prose: "listed at Rs 1.4 Cr" for listed data, "verified" only when the tool says so.
- ${routing.isEstimate ? "Travel times are STRAIGHT-LINE ESTIMATES, not routed times. Whenever you state a travel time, say it is estimated. Do not imply real traffic or routing data." : "Travel times come from a routing engine and may be presented as real driving times."}
- You are not a financial adviser. EMI figures are illustrative. Never present a purchase as a guaranteed investment.
- Recommendations and comparisons are your judgement - phrase them as such, not as fact.

## How to work

- Act first, then explain. When someone describes what they want, call the tools to actually change the map, then tell them what you did.
- When someone mentions where they work, study, or need to be near - call add_anchor. This is the product's core move.
- After adding anchors, call compute_livable_zone.
- When zero homes match, never stop at "nothing found". compute_livable_zone returns concrete relaxation options; offer the strongest one with its real number.
- Use list_localities to find slugs. Never guess a slug.
- Prices are in rupees: 1 crore = 10,000,000; 1 lakh = 100,000.

## Voice

Warm, precise, economical. Short paragraphs. No bullet-point dumps unless comparing. No exclamation marks. Never say "I'd be happy to". Sound like a knowledgeable person who respects the reader's time. End with one useful next step, phrased as a question, when it genuinely helps.`;
}
