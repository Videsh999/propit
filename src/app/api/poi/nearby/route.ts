import { NextResponse } from "next/server";
import { nearbyPlaces } from "@/lib/data/repository";
import { poiCategorySchema } from "@/lib/api/schema";
import type { PoiCategory } from "@/types";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "A location is required." }, { status: 400 });
  }
  const radiusKm = Math.min(Number(sp.get("radiusKm")) || 6, 40);
  const cats = (sp.get("categories") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((c): c is PoiCategory => poiCategorySchema.safeParse(c).success);

  return NextResponse.json({
    places: nearbyPlaces({ lat, lng }, cats.length ? cats : null, radiusKm, 4),
  });
}
