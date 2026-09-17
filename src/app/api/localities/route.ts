import { NextResponse } from "next/server";
import { allLocalities } from "@/lib/data/repository";

export async function GET() {
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
}
