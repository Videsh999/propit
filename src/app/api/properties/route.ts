import { NextResponse } from "next/server";
import { z } from "zod";
import { queryProperties, clusterFor, CLUSTER_MAX_ZOOM } from "@/lib/data/repository";
import { parsePropertyQuery, anchorSchema } from "@/lib/api/schema";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const q = parsePropertyQuery(sp);

    // Anchors may ride along on the querystring so a search stays shareable.
    let anchors: z.infer<typeof anchorSchema>[] = [];
    const raw = sp.get("anchors");
    if (raw) {
      try {
        anchors = z.array(anchorSchema).max(6).parse(JSON.parse(raw));
      } catch {
        anchors = [];
      }
    }

    const polygonRaw = sp.get("polygon");
    let polygon: [number, number][] | null = null;
    if (polygonRaw) {
      try {
        const parsed = z.array(z.tuple([z.number(), z.number()])).max(500).parse(JSON.parse(polygonRaw));
        polygon = parsed.length > 3 ? parsed : null;
      } catch {
        polygon = null;
      }
    }

    const result = queryProperties({
      filters: q.filters,
      bounds: q.bounds,
      center: q.center,
      radiusKm: q.radiusKm,
      polygon,
      anchors,
      sort: q.sort,
      limit: q.limit,
      offset: q.offset,
    });

    // The browser draws locality markers from localityCounts. Keep clusters
    // available for integrations that request the complete response.
    const clusters = sp.get("clusters") === "0" ? [] : clusterFor(result.points, q.zoom);
    return NextResponse.json({
      total: result.total,
      items: result.items,
      points: result.points,
      contextPoints: result.contextPoints,
      localityCounts: result.localityCounts,
      clusters,
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
      offset: q.offset,
      limit: q.limit,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid search parameters." }, { status: 400 });
    }
    console.error("[api/properties]", err);
    return NextResponse.json(
      { error: "We couldn't load properties just now. Please try again." },
      { status: 500 },
    );
  }
}
