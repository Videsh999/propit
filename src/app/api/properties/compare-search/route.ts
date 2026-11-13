import { NextResponse } from "next/server";
import { getStore } from "@/lib/data/store";
import { propertyTypeLabel } from "@/lib/format";
import type { CompareCandidate } from "@/lib/compare/types";

const PAGE_SIZE = 8;

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = normalize((params.get("q") ?? "").slice(0, 160));
  const bedrooms = query.match(/\b(\d+)\s*bhk\b/);
  const words = query.replace(/\b\d+\s*bhk\b/, "").split(" ").filter(Boolean);
  const mode = params.get("type");
  const rawPage = Number(params.get("page"));
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 10000) : 0;
  const store = getStore();

  const matches = store.properties.flatMap((property) => {
    if ((mode === "buy" || mode === "rent") && property.listingType !== mode) return [];
    if (bedrooms && property.bedrooms !== Number(bedrooms[1])) return [];
    const locality = store.localityById.get(property.localityId)?.name ?? "Hyderabad";
    const project = property.projectId ? store.projectById.get(property.projectId)?.name ?? "" : "";
    const title = normalize(property.title);
    const searchable = normalize([title, property.address, locality, project, property.slug, propertyTypeLabel(property.propertyType)].join(" "));
    if (!words.every((word) => searchable.includes(word))) return [];
    return [{ property, locality, titleMatch: Boolean(query) && title.includes(query) }];
  }).sort((a, b) =>
    Number(b.titleMatch) - Number(a.titleMatch) ||
    Number(b.property.isVerified) - Number(a.property.isVerified) ||
    b.property.viewCount - a.property.viewCount
  );

  const items: CompareCandidate[] = matches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(
    ({ property: { id, title, listingType, price, rentMonthly, builtupAreaSqft, images }, locality }) => ({
      id, title, listingType, price, rentMonthly, builtupAreaSqft, locality, image: images[0]?.url,
    })
  );
  return NextResponse.json({ items, hasMore: (page + 1) * PAGE_SIZE < matches.length });
}
