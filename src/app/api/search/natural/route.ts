import { NextResponse } from "next/server";
import { z } from "zod";
import { naturalRequestSchema } from "@/lib/api/schema";
import { parseQuery, describeParsed } from "@/lib/search/parser";
import { getStore } from "@/lib/data/store";
import { queryProperties } from "@/lib/data/repository";
import { getGeocodingProvider } from "@/lib/providers/geocoding";
import type { Anchor, PoiCategory } from "@/types";
import { haversineKm } from "@/lib/geo/spatial";

export const dynamic = "force-dynamic";

/**
 * Intent router. The deterministic parser handles the overwhelming majority of
 * searches instantly and for free; the assistant is only involved when the
 * query reads as a question or the parser has low confidence.
 */
export async function POST(req: Request) {
  try {
    const { query, context } = naturalRequestSchema.parse(await req.json());
    const store = getStore();
    const localityNames = store.localities.map((l) => l.name);
    const parsed = parseQuery(query, localityNames);

    const intent: "filter_query" | "question" | "mixed" =
      parsed.isQuestion && parsed.confidence < 0.35
        ? "question"
        : parsed.isQuestion
          ? "mixed"
          : "filter_query";

    // Resolve any place mentioned as a proximity target.
    let target: { name: string; location: { lat: number; lng: number }; kind: string } | null = null;

    if (parsed.localityMentions.length) {
      const l = store.localities.find((x) => x.name === parsed.localityMentions[0])!;
      target = { name: l.name, location: l.center, kind: "locality" };
    } else if (parsed.nearPlace) {
      const places = await getGeocodingProvider().search(parsed.nearPlace, store.city.center, 3);
      if (places[0]) {
        target = { name: places[0].name, location: places[0].location, kind: places[0].kind };
      } else if (parsed.poiCategoryMentions.length) {
        // "near a cricket ground" — no named place, so match the category instead.
        const cat = parsed.poiCategoryMentions[0] as PoiCategory;
        const candidates = store.pois.filter((p) => p.category === cat);
        const nearest = candidates.sort(
          (a, b) =>
            haversineKm(store.city.center, a.location) - haversineKm(store.city.center, b.location),
        )[0];
        if (nearest) target = { name: nearest.name, location: nearest.location, kind: "poi" };
      }
    }

    const filters = { ...(context.filters ?? {}), ...parsed.filters };
    const anchors: Anchor[] = context.anchors ?? [];

    // "near X" means proximity, not "inside X" — default to a 5 km ring when
    // the query says near but names no distance. "in X" scopes by boundary.
    const NEAR_DEFAULT_KM = 5;
    const radiusKm = parsed.radiusKm ?? (parsed.nearPlace && target ? NEAR_DEFAULT_KM : null);
    const center = target?.location ?? context.center ?? null;

    if (parsed.localityMentions.length && !radiusKm) {
      filters.localitySlugs = parsed.localityMentions
        .map((n) => store.localities.find((l) => l.name === n)?.slug)
        .filter((s): s is string => !!s);
    }

    const result = queryProperties({
      filters,
      center: radiusKm ? center : null,
      radiusKm: radiusKm ?? null,
      anchors,
      limit: 24,
    });

    return NextResponse.json({
      intent,
      query,
      parsed: {
        filters,
        radiusKm,
        maxMinutes: parsed.maxMinutes,
        target,
        confidence: parsed.confidence,
        summary: describeParsed(parsed),
        matchedTerms: parsed.matchedTerms,
      },
      total: result.total,
      items: result.items.slice(0, 12),
      needsAssistant: intent !== "filter_query",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "That search couldn't be read." }, { status: 400 });
    }
    console.error("[api/search/natural]", err);
    return NextResponse.json({ error: "Search is unavailable right now." }, { status: 500 });
  }
}
