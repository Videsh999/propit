import "server-only";
import { getStore } from "@/lib/data/store";
import { formatPrice, propertyTypeLabel } from "@/lib/format";
import type { Anchor, PropertyFilters } from "@/types";

export interface Situation {
  filters: Partial<PropertyFilters>;
  anchors: Anchor[];
  localitySlug?: string | null;
  propertyId?: string | null;
  projectSlug?: string | null;
  comparisonIds?: string[];
  resultCount?: number | null;
}

/**
 * Describes the user's current view for the assistant.
 *
 * Without this the user has to restate their situation every turn — "the one in
 * Kokapet", "the 3 BHK I just opened" would be meaningless. Everything here is
 * read from the store, so the assistant is being told facts, not guesses.
 */
export function describeSituation(ctx: Situation): string {
  const store = getStore();
  const lines: string[] = [];

  const f = ctx.filters ?? {};
  const filterBits: string[] = [];
  if (f.listingType) filterBits.push(f.listingType === "rent" ? "renting" : "buying");
  if (f.bedrooms?.length) filterBits.push(f.bedrooms.map((b) => (b === 0 ? "studio" : `${b} BHK`)).join(" or "));
  if (f.propertyTypes?.length) filterBits.push(f.propertyTypes.map(propertyTypeLabel).join(" or "));
  if (f.priceMin != null || f.priceMax != null) {
    filterBits.push(
      `${f.priceMin != null ? formatPrice(f.priceMin) : "any"} to ${f.priceMax != null ? formatPrice(f.priceMax) : "any"}`,
    );
  }
  if (f.localitySlugs?.length) {
    const names = f.localitySlugs
      .map((slug) => store.localityBySlug.get(slug)?.name)
      .filter(Boolean);
    if (names.length) filterBits.push(`in ${names.join(", ")}`);
  }
  if (filterBits.length) lines.push(`Current search: ${filterBits.join(", ")}.`);
  if (ctx.resultCount != null) lines.push(`That search currently returns ${ctx.resultCount} homes.`);

  if (ctx.anchors?.length) {
    lines.push(
      "Their places: " +
        ctx.anchors.map((a) => `${a.label} at ${a.address || "a dropped pin"} (within ${a.maxKm} km)`).join("; ") +
        ".",
    );
  }

  if (ctx.localitySlug) {
    const l = store.localityBySlug.get(ctx.localitySlug);
    if (l) lines.push(`They have ${l.name} open on the map — assume "here" and "this area" mean ${l.name}.`);
  }

  if (ctx.propertyId) {
    const p = store.propertyById.get(ctx.propertyId);
    if (p) {
      const loc = store.localityById.get(p.localityId);
      lines.push(
        `They have this home selected: "${p.title}" in ${loc?.name ?? "Hyderabad"}, id ${p.id}. ` +
          `Assume "this one", "it" and "this property" mean that home, and pass that id to tools.`,
      );
    }
  }
  if (ctx.projectSlug) {
    const p = store.projectBySlug.get(ctx.projectSlug);
    if (p) lines.push(`Project open: ${p.name}, slug ${p.slug}. "This project" refers to it.`);
  }
  const comparison = (ctx.comparisonIds ?? []).flatMap((id) => {
    const p = store.propertyById.get(id);
    return p ? [`${p.title} (id ${p.id})`] : [];
  });
  if (comparison.length) lines.push(`Selected comparison: ${comparison.join("; ")}.`);

  if (!lines.length) return "";
  return lines.join("\n") + "\nDo not ask them to repeat any of this.";
}
