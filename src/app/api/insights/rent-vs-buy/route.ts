import { NextResponse } from "next/server";
import { z } from "zod";
import { corridorRentBuy } from "@/lib/data/repository";

/**
 * Sale and rental medians per corridor for one configuration.
 *
 * The arithmetic itself stays on the client: every assumption is a control the
 * reader can move, and a round trip per slider drag would make the crossover
 * feel like a report rather than a model.
 */
const query = z.object({
  bedrooms: z.coerce.number().int().min(1).max(6).default(3),
});

export async function GET(req: Request) {
  const parsed = query.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Unsupported configuration." }, { status: 400 });
  }

  const corridors = corridorRentBuy(parsed.data.bedrooms);
  return NextResponse.json(
    { bedrooms: parsed.data.bedrooms, corridors },
    { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=600" } },
  );
}
