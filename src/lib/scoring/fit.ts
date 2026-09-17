import type { Anchor, FitBreakdown, Property, PropertyFilters } from "@/types";
import { haversineKm } from "@/lib/geo/spatial";
import { estimateLeg } from "@/lib/providers/routing";
import { clamp } from "@/lib/utils";

/**
 * Fit Score — deliberately simple and fully explainable.
 *
 *   anchorFit = Σ(wᵢ · sᵢ) / Σwᵢ      sᵢ = clamp(0,1, 1 − dᵢ / limitᵢ)
 *   final     = 0.70·anchorFit + 0.20·budgetFit + 0.10·typeMatch
 *
 * Every term is surfaced in the UI. No black boxes — trust is the product.
 */
export function scoreProperty(
  property: Property,
  anchors: Anchor[],
  filters: PropertyFilters,
): { fitScore: number; breakdown: FitBreakdown[]; budgetFit: number; typeMatch: number } {
  const breakdown: FitBreakdown[] = [];
  let wSum = 0;
  let sSum = 0;

  for (const a of anchors) {
    const distanceKm = haversineKm(property.location, a.location);
    const leg = estimateLeg(property.location, a.location);
    // Linear decay to the limit; anything beyond scores zero for that anchor.
    const score = clamp(1 - distanceKm / Math.max(a.maxKm, 0.1), 0, 1);
    const w = a.weight;
    wSum += w;
    sSum += w * score;
    breakdown.push({
      anchorId: a.id,
      label: a.label,
      distanceKm: Math.round(distanceKm * 100) / 100,
      limitKm: a.maxKm,
      minutes: leg.minutes,
      score: Math.round(score * 100),
      weight: w,
    });
  }

  const anchorFit = wSum > 0 ? sSum / wSum : 0;

  // Budget: 1.0 inside the range, decaying outside it rather than snapping to 0.
  let budgetFit = 1;
  const price = property.listingType === "rent" ? (property.rentMonthly ?? property.price) : property.price;
  if (filters.priceMax != null && price > filters.priceMax) {
    budgetFit = clamp(1 - (price - filters.priceMax) / filters.priceMax, 0, 1);
  } else if (filters.priceMin != null && price < filters.priceMin) {
    budgetFit = clamp(1 - (filters.priceMin - price) / Math.max(filters.priceMin, 1), 0, 1);
  }

  const typeMatch =
    filters.propertyTypes.length === 0 || filters.propertyTypes.includes(property.propertyType)
      ? 1
      : 0.35;

  const final = anchors.length
    ? 0.7 * anchorFit + 0.2 * budgetFit + 0.1 * typeMatch
    : 0.68 * budgetFit + 0.32 * typeMatch;

  return {
    fitScore: Math.round(final * 100),
    breakdown,
    budgetFit: Math.round(budgetFit * 100),
    typeMatch: Math.round(typeMatch * 100),
  };
}

export function fitLabel(score: number): { label: string; tone: "strong" | "good" | "fair" } {
  if (score >= 82) return { label: "Excellent fit", tone: "strong" };
  if (score >= 66) return { label: "Good fit", tone: "good" };
  return { label: "Fair fit", tone: "fair" };
}
