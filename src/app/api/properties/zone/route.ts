import { apiError, HttpError, readJson } from "@/lib/api/http";
import { requestBudget } from "@/lib/api/rate-limit";
import { prepareStore } from "@/lib/data/store";
import { NextResponse } from "next/server";
import { computeZone } from "@/lib/data/repository";
import { zoneRequestSchema } from "@/lib/api/schema";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (req.url.length > 16384) throw new HttpError(414, "This search URL is too long.");
    const requestBody = await readJson(req);
    await requestBudget(req, "read");
    await prepareStore();

    const body = zoneRequestSchema.parse(requestBody);
    const result = computeZone(body.anchors, body.filters, body.limit);
    return NextResponse.json(result);

  } catch (error) { return apiError(error); }
}
