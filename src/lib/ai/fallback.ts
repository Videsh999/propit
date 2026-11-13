import "server-only";
import { parseQuery } from "@/lib/search/parser";
import { getStore } from "@/lib/data/store";
import { AMENITIES } from "@/lib/data/developers";
import type { Property } from "@/types";
import { runTool, type ClientAction, type ToolContext } from "./tools";
import { bhkLabel, formatArea, formatDistance, formatPrice, formatPriceSqft, formatRent, furnishingLabel, possessionLabel, propertyTypeLabel } from "@/lib/format";
import { localityIntelligence, nearbyPlaces } from "@/lib/data/repository";
import { findLocalities, lookupKnowledge, showcaseSource } from "./knowledge";
import { OFFICIAL_SOURCES, SHOWCASE_NOTE, type AssistantSource } from "./sources";

/**
 * Deterministic concierge used when no LLM key is configured.
 *
 * It is not a mock: it runs the same tools against the same data and returns
 * grounded answers with real map actions. Less conversational than the model,
 * equally truthful.
 */
export async function fallbackConcierge(
  message: string,
  ctx: ToolContext,
): Promise<{ text: string; actions: ClientAction[]; statuses: string[]; sources?: AssistantSource[] }> {
  const knowledge = lookupKnowledge(message, ctx);
  if (knowledge) return { ...knowledge, actions: [], statuses: [] };
  const propertyAnswer = answerPropertyQuestion(message, ctx.propertyId);
  if (propertyAnswer) return { ...propertyAnswer, actions: [], statuses: [] };

  const store = getStore();
  const parsed = parseQuery(
    message,
    store.localities.map((l) => l.name),
  );
  const actions: ClientAction[] = [];
  const statuses: string[] = [];
  const lines: string[] = [];
  const matchedLocalities = findLocalities(message);
  const explicitSearch = /\b(?:find|show|search|looking for|switch to|only|under|below|budget)\b/i.test(message);
  const hasSearchCriteria = explicitSearch || Object.keys(parsed.filters).length > 0;

  // --- anchor intent: "my office is in X", "school near Y" ---
  const anchorPatterns: { re: RegExp; kind: "office" | "school" | "family" | "gym"; label: string }[] = [
    { re: /\b(?:my\s+)?office\s+(?:is\s+)?(?:in|at|near)\s+([a-z][a-z0-9'.\- ]{2,40})/i, kind: "office", label: "Office" },
    { re: /\b(?:son|daughter|kid|child)(?:'s)?\s+school\s+(?:is\s+)?(?:in|at|near)\s+([a-z][a-z0-9'.\- ]{2,40})/i, kind: "school", label: "School" },
    { re: /\bschool\s+(?:is\s+)?(?:in|at|near)\s+([a-z][a-z0-9'.\- ]{2,40})/i, kind: "school", label: "School" },
    { re: /\b(?:parents|family)\s+(?:live\s+)?(?:in|at|near)\s+([a-z][a-z0-9'.\- ]{2,40})/i, kind: "family", label: "Family" },
  ];

  let anchorRequested = false;
  const handledAnchors = new Set<string>();
  for (const p of anchorPatterns) {
    const m = message.match(p.re);
    if (!m || handledAnchors.has(p.kind)) continue;
    handledAnchors.add(p.kind);
    anchorRequested = true;
    const place = m[1].trim().replace(/\s+(and|with|,).*$/i, "");
    const out = await runTool(
      "add_anchor",
      { label: p.label, kind: p.kind, place, maxKm: parsed.radiusKm ?? 5 },
      ctx,
    );
    actions.push(...out.actions);
    if (out.status) statuses.push(out.status);
    const r = out.result as { added?: { resolvedTo: string; maxKm: number }; error?: string };
    if (r.added) {
      lines.push(`Placed **${p.label}** at ${r.added.resolvedTo}, within ${r.added.maxKm} km.`);
    } else if (r.error) {
      lines.push(r.error);
    }
  }

  // --- locality question ---
  // "tell me about here" should work when a locality is already open.
  const mentionedLocality =
    matchedLocalities[0]?.name ??
    (parsed.isQuestion && ctx.localitySlug
      ? store.localityBySlug.get(ctx.localitySlug)?.name
      : undefined);
  if (parsed.isQuestion && mentionedLocality && !hasSearchCriteria && !anchorRequested) {
    const l = store.localities.find((x) => x.name === mentionedLocality)!;
    const intel = localityIntelligence(l.slug);
    if (intel) {
      statuses.push(`Pulled data for ${l.name}`);
      lines.push(
        `**${l.name}** — ${l.character}.`,
        "",
        `Average ${formatPriceSqft(intel.stats.avgPriceSqft)} · median ${formatPrice(
          intel.stats.medianPrice,
        )} · ${intel.stats.inventory} homes across ${intel.stats.projects} projects.`,
        `Rental yield around ${intel.stats.rentalYieldPct}% and prices up ${intel.stats.momentumPct}% year on year. Those two figures are estimates from PropIT's own model, not audited data.`,
        "",
        intel.locality.summary,
      );
      if (intel.connectivity.length) {
        lines.push(
          "",
          "Connectivity: " +
            intel.connectivity
              .slice(0, 4)
              .map((c) => `${c.name} ${c.distanceKm} km`)
              .join(" · ") +
            ".",
        );
      }
      return { text: [...lines, "", SHOWCASE_NOTE].join("\n"), actions, statuses, sources: [showcaseSource(l.name, "/locality/" + l.slug)] };
    }
  }

  // --- zone recompute when anchors exist ---
  if (anchorRequested || (ctx.anchors.length && /\b(?:livable zone|anchors|prioriti[sz]e|between my)\b/i.test(message))) {
    if (!ctx.anchors.length) return { text: lines.join("\n") || "Add an office or school to start a commute search.", actions, statuses };
    const prioritise = message.match(/priorit\w*\s+(?:my\s+)?(\w+)/i)?.[1];
    const out = await runTool("compute_livable_zone", prioritise ? { prioritise } : {}, ctx);
    actions.push(...out.actions);
    if (out.status) statuses.push(out.status);
    const r = out.result as {
      total: number;
      areaKm2: number;
      bestLocalities: { name: string; count: number; avgPriceSqft: number }[];
      relaxationOptions: { label: string; unlocks: number; message: string }[];
      routingIsEstimate: boolean;
    };

    if (r.total > 0) {
      lines.push(
        "",
        `That leaves **${r.total} ${r.total === 1 ? "home" : "homes"}** across roughly ${r.areaKm2} km².`,
      );
      if (r.bestLocalities.length) {
        lines.push(
          "",
          "Strongest areas: " +
            r.bestLocalities
              .slice(0, 3)
              .map((b) => `${b.name} (${b.count}, ${formatPriceSqft(b.avgPriceSqft)})`)
              .join(" · ") +
            ".",
        );
      }
      if (r.routingIsEstimate) {
        lines.push("", "_Travel times shown across PropIT are estimated from distance — routing isn't connected yet._");
      }
    } else if (r.relaxationOptions.length) {
      lines.push("", `Nothing matches every constraint yet. ${r.relaxationOptions[0].message}`);
    } else {
      lines.push("", "Nothing matches every constraint, and I couldn't find a small change that would help. Try widening a distance or the budget.");
    }
    return { text: [...lines, "", SHOWCASE_NOTE].join("\n"), actions, statuses, sources: out.sources };
  }

  // --- plain search ---
  if (hasSearchCriteria || (!parsed.isQuestion && (parsed.confidence >= 0.2 || matchedLocalities.length))) {
    const out = await runTool(
      "search_properties",
      {
        ...parsed.filters,
        ...(matchedLocalities.length && !parsed.nearPlace ? { localitySlugs: matchedLocalities.map((l) => l.slug) } : {}),
        ...(parsed.nearPlace ? { nearPlace: parsed.nearPlace } : {}),
        ...(parsed.radiusKm ? { radiusKm: parsed.radiusKm } : {}),
        updateMap: explicitSearch || !parsed.isQuestion,
      },
      ctx,
    );
    actions.push(...out.actions);
    if (out.status) statuses.push(out.status);
    const r = out.result as {
      total: number;
      searchedAround: string | null;
      error?: string;
      topResults: { title: string; locality: string; price: string; areaSqft: number }[];
    };

    if (r.error) return { text: r.error, actions, statuses };
    if (r.total === 0) {
      lines.push(
        "Nothing matched that exactly. Try widening the budget or the area — tell me which you'd rather move and I'll adjust the map.",
      );
    } else {
      lines.push(
        `**${r.total} ${r.total === 1 ? "home" : "homes"}** match${r.total === 1 ? "es" : ""}${
          r.searchedAround ? ` around ${r.searchedAround}` : ""
        } in PropIT’s showcase catalog.`,
      );
      if (r.topResults.length) {
        lines.push(
          "",
          ...r.topResults.slice(0, 3).map((t) => `· ${t.title} — ${t.locality}, ${t.price}, ${t.areaSqft} sq.ft`),
        );
      }
      lines.push("", "Want me to narrow this by distance from somewhere that matters to you?");
    }
    return { text: [...lines, "", SHOWCASE_NOTE].join("\n"), actions, statuses, sources: out.sources };
  }

  // --- nothing actionable ---
  return {
    text: [
      "I can search PropIT's Hyderabad inventory and move the map for you. Try:",
      "",
      "· “3 BHK under 2 crore in Kokapet”",
      "· “My office is in Financial District” — I'll place it and find homes around it",
      "· “Tell me about Tellapur”",
      "· “Villas within 5 km of Gachibowli”",
      "",
      "I can also look up a PropIT project, compare two localities, or show where to check TG RERA and land records.",
    ].join("\n"),
    actions,
    statuses,
  };
}


function asksAboutProperty(message: string, mentionsLocality: boolean): boolean {
  if (/\b(?:this|current|selected) (?:property|listing|home|apartment|villa)\b/i.test(message)) return true;
  if (mentionsLocality || /\b(?:find|show me|search|compare|under|within|looking for|my office|my school)\b/i.test(message)) return false;
  return /\b(?:it|its|price|cost|amenities|nearby|metro|schools?|hospitals?|maintenance|deposit|ready|parking|possession|bedrooms?|bathrooms?|furnish\w*|carpet area|built.up area|super area|floors?|facing|size)\b/i.test(message);
}

export function answerPropertyQuestion(question: string, propertyId: string | null | undefined): { text: string; sources: AssistantSource[] } | null {
  if (!propertyId) return null;
  const store = getStore();
  const property = store.propertyById.get(propertyId);
  const normalized = question.toLowerCase();
  const mentionsLocality = store.localities.some(({ name }) => normalized.includes(name.toLowerCase()));
  if (!property || !asksAboutProperty(question, mentionsLocality)) return null;
  return {
    text: describeProperty(property, question),
    sources: [showcaseSource(property.title, "/property/" + property.slug), ...(/\bmetro\b/i.test(question) ? [OFFICIAL_SOURCES.metro] : [])],
  };
}

function describeProperty(property: Property, question: string): string {
  const store = getStore();
  const project = property.projectId ? store.projectById.get(property.projectId) : undefined;
  const price = property.listingType === "rent"
    ? property.rentMonthly === null ? "Monthly rent unavailable" : formatRent(property.rentMonthly)
    : formatPrice(property.price);
  const amenities = property.amenities.map((slug) => AMENITIES.find((amenity) => amenity.slug === slug)?.name ?? slug);
  const lines = [`**${property.title}**`, property.address];
  if (/\b(?:floor plan|brochure|cost sheet|specifications)\b/i.test(question)) {
    lines.push(property.floorPlanUrl ? "A floor plan is listed on the property page." : "This listing has no floor plan on file.");
    if (project) lines.push(`The linked development is ${project.name}. Open its project page for any documents the catalog contains.`);
    return [...lines, "", SHOWCASE_NOTE].join("\n");
  }
  const locationQuestion = /\b(?:nearby|metro|schools?|hospitals?|parks?|commute|distance|surroundings)\b/i.test(question);

  if (locationQuestion) {
    const categories = /\bmetro\b/i.test(question) ? ["metro"] as const
      : /\bschools?\b/i.test(question) ? ["school"] as const
        : /\bhospitals?\b/i.test(question) ? ["hospital"] as const
          : ["school", "hospital", "metro", "office_hub", "mall", "park"] as const;
    const places = nearbyPlaces(property.location, [...categories], 6, 1, { verifiedOnly: true })
      .sort((a, b) => a.distanceKm - b.distanceKm);
    lines.push("", places.length ? "Nearby places by straight-line distance" : "The listing has no mapped places in these categories within 6 km.");
    for (const place of places) lines.push(`· ${place.name} · ${formatDistance(place.distanceKm)}`);
  } else {
    lines.push(
      "",
      `· **Listed price** ${price}`,
      `· **Property** ${propertyTypeLabel(property.propertyType)}${property.bedrooms > 0 ? ` · ${bhkLabel(property.bedrooms)}` : ""} · ${formatArea(property.builtupAreaSqft)} ${property.propertyType === "plot" ? "plot area" : "built-up"}`,
      `· **Possession** ${possessionLabel(property.possession)}`,
    );
    if (project) lines.push(`· **Development** ${project.name}`);
    if (property.bathrooms > 0) lines.push(`· **Layout** ${property.bathrooms} bath · ${furnishingLabel(property.furnishing)}`);
    if (property.maintenanceMonthly > 0) lines.push(`· **Maintenance** ${formatRent(property.maintenanceMonthly)}`);
    if (property.listingType === "rent" && property.deposit !== null) lines.push(`· **Deposit** ${formatPrice(property.deposit, { compact: false })}`);
    if (property.propertyType !== "plot") {
      if (property.carpetAreaSqft > 0) lines.push(`· **Carpet area** ${formatArea(property.carpetAreaSqft)}`);
      lines.push(`· **Super built-up area** ${property.superBuiltupAreaSqft ? formatArea(property.superBuiltupAreaSqft) : "Not listed"}`);
    }
    if (/\b(?:floor|facing|parking|layout|specs?)\b/i.test(question)) {
      if (property.totalFloors > 0) lines.push(`· **Floor** ${property.floor} of ${property.totalFloors}`);
      if (property.facing) lines.push(`· **Facing** ${property.facing}`);
      lines.push(`· **Parking spaces** ${property.parking}`);
    }
    lines.push("", amenities.length ? `**Listed amenities** ${amenities.join(", ")}.` : "The listing has no amenity details.");
  }
  lines.push("", SHOWCASE_NOTE);
  return lines.join("\n");
}
