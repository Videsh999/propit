import { NextResponse } from "next/server";
import { localityIntelligence } from "@/lib/data/repository";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const data = localityIntelligence(slug);
  if (!data) {
    return NextResponse.json({ error: "We don't have that locality yet." }, { status: 404 });
  }
  return NextResponse.json(data);
}
