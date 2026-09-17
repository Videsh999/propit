import { NextResponse } from "next/server";
import { z } from "zod";
import { computeZone } from "@/lib/data/repository";
import { zoneRequestSchema } from "@/lib/api/schema";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = zoneRequestSchema.parse(await req.json());
    const result = computeZone(body.anchors, body.filters, body.limit);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid anchors or filters." }, { status: 400 });
    }
    console.error("[api/properties/zone]", err);
    return NextResponse.json(
      { error: "We couldn't work out your livable zone. Please try again." },
      { status: 500 },
    );
  }
}
