/** Indian price formatting. Crore / Lakh, never scientific, never jittery. */
export function formatPrice(n: number, opts: { compact?: boolean } = {}): string {
  const { compact = true } = opts;
  if (!Number.isFinite(n)) return "—";
  if (!compact) return "₹" + n.toLocaleString("en-IN");
  if (n >= 1_00_00_000) {
    const cr = n / 1_00_00_000;
    return `₹${cr >= 10 ? cr.toFixed(1) : cr.toFixed(2)} Cr`;
  }
  if (n >= 1_00_000) {
    const l = n / 1_00_000;
    return `₹${l >= 10 ? Math.round(l) : l.toFixed(1)} L`;
  }
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

export function formatRent(n: number): string {
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L/mo`;
  return `₹${Math.round(n).toLocaleString("en-IN")}/mo`;
}

export function formatPriceSqft(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}/sq.ft`;
}

export function formatArea(n: number): string {
  return `${Math.round(n).toLocaleString("en-IN")} sq.ft`;
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-IN");
}

export function bhkLabel(n: number): string {
  return n === 0 ? "Studio" : `${n} BHK`;
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: "Apartment",
  villa: "Villa",
  plot: "Plot",
  independent_house: "Independent House",
  penthouse: "Penthouse",
  farmhouse: "Farmhouse",
  commercial: "Commercial",
};
export const propertyTypeLabel = (t: string) => PROPERTY_TYPE_LABELS[t] ?? t;

const POSSESSION_LABELS: Record<string, string> = {
  ready: "Ready to move",
  within_6_months: "Within 6 months",
  within_1_year: "Within 1 year",
  under_construction: "Under construction",
};
export const possessionLabel = (t: string) => POSSESSION_LABELS[t] ?? t;

const PROJECT_STATUS_LABELS: Record<string, string> = {
  new_launch: "Just launched",
  under_construction: "Under construction",
  ready: "Ready to move",
  upcoming: "Pre-launch",
};
export const projectStatusLabel = (t: string) => PROJECT_STATUS_LABELS[t] ?? t;

const FURNISHING_LABELS: Record<string, string> = {
  unfurnished: "Unfurnished",
  semi_furnished: "Semi-furnished",
  fully_furnished: "Fully furnished",
};
export const furnishingLabel = (t: string) => FURNISHING_LABELS[t] ?? t;

/** EMI — illustrative only, and the UI must say so. */
export function calcEmi(principal: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 12 / 100;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}
