import { apiError, HttpError } from "@/lib/api/http";
import { requestBudget } from "@/lib/api/rate-limit";
import { prepareStore } from "@/lib/data/store";
import { NextResponse } from "next/server";
import { nearbyPlaces } from "@/lib/data/repository";
import { latLngSchema, poiCategorySchema } from "@/lib/api/schema";
import type { PoiCategory } from "@/types";

export async function GET(req: Request) {
  try {
    if (req.url.length > 16384) throw new HttpError(414, "This search URL is too long.");
    await requestBudget(req, "read");
    await prepareStore();

  const sp = new URL(req.url).searchParams;
  const lat = sp.get("lat");
  const lng = sp.get("lng");
  const parsed = latLngSchema.safeParse({ lat: lat?.trim() ? Number(lat) : null, lng: lng?.trim() ? Number(lng) : null });
  if (!parsed.success) {
    return NextResponse.json({ error: "A location is required." }, { status: 400 });
  }
  const value = sp.get("radiusKm");
  const radius = value === null ? 6 : Number(value);
  if (!Number.isFinite(radius) || radius <= 0) {
    return NextResponse.json({ error: "A positive search radius is required." }, { status: 400 });
  }
  const radiusKm = Math.min(radius, 40);
  const cats = (sp.get("categories") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((c): c is PoiCategory => poiCategorySchema.safeParse(c).success);

  return NextResponse.json({
    places: nearbyPlaces(parsed.data, cats.length ? cats : null, radiusKm, 4),
  });

  } catch (error) { return apiError(error); }
}
