import { NextResponse } from "next/server";
import { poisInBounds } from "@/lib/data/repository";
import { boundsSchema, poiCategorySchema } from "@/lib/api/schema";
import type { PoiCategory } from "@/types";

export const dynamic = "force-dynamic";

/**
 * What is nearby, for the box currently on screen.
 *
 * Returns a count for every category plus the places for the categories that
 * are switched on, so the Nearby panel and the map are answered by one query
 * and can never disagree.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const num = (k: string) => {
    const v = Number(sp.get(k));
    return Number.isFinite(v) ? v : null;
  };

  const parsed = boundsSchema.safeParse({
    west: num("west"),
    south: num("south"),
    east: num("east"),
    north: num("north"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "A map viewport is required." }, { status: 400 });
  }

  const active = (sp.get("categories") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((c): c is PoiCategory => poiCategorySchema.safeParse(c).success);

  return NextResponse.json(poisInBounds(parsed.data, active));
}
