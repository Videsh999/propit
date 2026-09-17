import { NextResponse } from "next/server";
import { getStore } from "@/lib/data/store";
import { haversineKm } from "@/lib/geo/spatial";
import { parseQuery } from "@/lib/search/parser";

export interface Suggestion {
  id: string;
  group: "Localities" | "Projects" | "Developers" | "Nearby" | "Properties";
  label: string;
  sublabel: string;
  href: string | null;
  location: { lat: number; lng: number } | null;
  slug: string | null;
  count?: number;
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json({ suggestions: [], parsed: null });

  const needle = q.toLowerCase();
  const store = getStore();
  const out: Suggestion[] = [];

  for (const l of store.localities) {
    const n = l.name.toLowerCase();
    if (!n.includes(needle)) continue;
    out.push({
      id: l.id,
      group: "Localities",
      label: l.name,
      sublabel: `${l.corridor} · ₹${l.avgPriceSqft.toLocaleString("en-IN")}/sq.ft`,
      href: `/locality/${l.slug}`,
      location: l.center,
      slug: l.slug,
      count: l.inventoryCount,
    });
    if (out.length > 5) break;
  }

  let projectHits = 0;
  for (const p of store.projects) {
    if (!p.name.toLowerCase().includes(needle)) continue;
    const loc = store.localityById.get(p.localityId);
    out.push({
      id: p.id,
      group: "Projects",
      label: p.name,
      sublabel: `${store.developerById.get(p.developerId)?.name ?? "Developer"} · ${loc?.name ?? ""}`,
      href: `/project/${p.slug}`,
      location: p.location,
      slug: p.slug,
    });
    if (++projectHits >= 4) break;
  }

  let devHits = 0;
  for (const d of store.developers) {
    if (!d.name.toLowerCase().includes(needle)) continue;
    out.push({
      id: d.id,
      group: "Developers",
      label: d.name,
      sublabel: `${d.projectsDelivered} projects delivered · since ${d.establishedYear}`,
      href: `/developer/${d.slug}`,
      location: null,
      slug: d.slug,
    });
    if (++devHits >= 3) break;
  }

  let poiHits = 0;
  const cityCenter = store.city.center;
  for (const p of store.pois) {
    if (!p.name.toLowerCase().includes(needle)) continue;
    out.push({
      id: p.id,
      group: "Nearby",
      label: p.name,
      sublabel: `${p.subcategory} · ${Math.round(haversineKm(cityCenter, p.location))} km from centre`,
      href: null,
      location: p.location,
      slug: null,
    });
    if (++poiHits >= 4) break;
  }

  const parsed = parseQuery(
    q,
    store.localities.map((l) => l.name),
  );

  return NextResponse.json({
    suggestions: out.slice(0, 14),
    parsed: {
      filters: parsed.filters,
      nearPlace: parsed.nearPlace,
      radiusKm: parsed.radiusKm,
      maxMinutes: parsed.maxMinutes,
      localityMentions: parsed.localityMentions,
      confidence: parsed.confidence,
      isQuestion: parsed.isQuestion,
    },
  });
}
