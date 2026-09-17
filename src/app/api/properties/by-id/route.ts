import { NextResponse } from "next/server";
import { z } from "zod";
import { getPropertiesByIds } from "@/lib/data/repository";
import { scoreProperty } from "@/lib/scoring/fit";
import { anchorSchema, filtersSchema } from "@/lib/api/schema";
import { DEFAULT_FILTERS } from "@/lib/data/filters";
import type { ScoredProperty } from "@/types";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const ids = (sp.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 60);
  if (!ids.length) return NextResponse.json({ items: [] });

  /**
   * Anchors may ride along so a home fetched on its own still knows how well it
   * fits. The map hands back only an id when a marker is clicked, and a preview
   * that silently dropped the Fit Score would be telling the user less about
   * the same home purely because of where they clicked it.
   */
  let anchors: z.infer<typeof anchorSchema>[] = [];
  const rawAnchors = sp.get("anchors");
  if (rawAnchors) {
    try {
      anchors = z.array(anchorSchema).max(6).parse(JSON.parse(rawAnchors));
    } catch {
      anchors = [];
    }
  }

  const filters = filtersSchema.parse({
    listingType: sp.get("type") ?? "buy",
    priceMin: sp.get("minPrice") ? Number(sp.get("minPrice")) : null,
    priceMax: sp.get("maxPrice") ? Number(sp.get("maxPrice")) : null,
    propertyTypes: (sp.get("propertyType") ?? "").split(",").filter(Boolean),
  });

  // Preserve the caller's ordering — it is the user's own list order.
  const items: ScoredProperty[] = getPropertiesByIds(ids).map((p) => {
    const s = scoreProperty(p, anchors, { ...DEFAULT_FILTERS, ...filters });
    return {
      ...p,
      fitScore: s.fitScore,
      fitBreakdown: s.breakdown,
      budgetFit: s.budgetFit,
      typeMatch: s.typeMatch,
    };
  });

  return NextResponse.json({ items });
}
