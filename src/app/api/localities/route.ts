import { apiError, HttpError } from "@/lib/api/http";
import { requestBudget } from "@/lib/api/rate-limit";
import { prepareStore } from "@/lib/data/store";
import { NextResponse } from "next/server";
import { allLocalities } from "@/lib/data/repository";

export async function GET(request: Request) {
  try {
    if (request.url.length > 16384) throw new HttpError(414, "This search URL is too long.");
    await requestBudget(request, "read");
    await prepareStore();

  const localities = allLocalities().map((l) => ({
    id: l.id,
    name: l.name,
    slug: l.slug,
    center: l.center,
    corridor: l.corridor,
    character: l.character,
    avgPriceSqft: l.avgPriceSqft,
    medianPrice: l.medianPrice,
    inventoryCount: l.inventoryCount,
    projectCount: l.projectCount,
    momentumPct: l.momentumPct,
    rentalYieldPct: l.rentalYieldPct,
    heroImage: l.heroImage,
  }));
  return NextResponse.json({ localities });

  } catch (error) { return apiError(error); }
}
