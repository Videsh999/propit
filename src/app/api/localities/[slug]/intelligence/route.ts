import { apiError, HttpError } from "@/lib/api/http";
import { requestBudget } from "@/lib/api/rate-limit";
import { prepareStore } from "@/lib/data/store";
import { NextResponse } from "next/server";
import { localityIntelligence } from "@/lib/data/repository";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    if (_req.url.length > 16384) throw new HttpError(414, "This search URL is too long.");
    await requestBudget(_req, "read");
    await prepareStore();

  const { slug } = await params;
  const data = localityIntelligence(slug);
  if (!data) {
    return NextResponse.json({ error: "We don't have that locality yet." }, { status: 404 });
  }
  return NextResponse.json(data);

  } catch (error) { return apiError(error); }
}
