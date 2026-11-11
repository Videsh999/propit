"use client";

import { useState } from "react";
import Link from "next/link";
import { X, MessageCircle, Check } from "lucide-react";
import { useDiscovery } from "@/store/discovery";
import { Img } from "@/components/ui/img";
import { QualityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePropertiesByIds } from "@/lib/hooks/use-properties";
import { useStoreHydrated } from "@/lib/hooks/use-hydrated";
import { AMENITY_BY_SLUG } from "@/lib/data/developers";
import {
  formatArea, formatPrice, formatPriceSqft, formatRent, furnishingLabel, possessionLabel, propertyTypeLabel,
} from "@/lib/format";
import type { Property } from "@/types";
import { cn } from "@/lib/utils";

/** Best value per row, computed across the selected homes only. */
function computeBest(items: Property[]) {
  const best = new Map<string, string>();
  for (const row of ROWS) {
    if (!row.better || !row.raw) continue;
    const raw = row.raw;
    const sorted = items.filter((item) => Number.isFinite(raw(item))).sort((a, b) =>
      row.better === "low" ? raw(a) - raw(b) : raw(b) - raw(a),
    );
    if (sorted.length > 1 && raw(sorted[0]) !== raw(sorted[1])) {
      best.set(row.label, sorted[0].id);
    }
  }
  return { best, allAmenities: [...new Set(items.flatMap((p) => p.amenities))] };
}

type Row = {
  label: string;
  get: (p: Property) => string;
  /** "low" or "high" marks which end of the range is the better value. */
  better?: "low" | "high";
  raw?: (p: Property) => number;
};

const ROWS: Row[] = [
  { label: "Listing", get: (p) => p.listingType === "buy" ? "For sale" : "For rent" },
  { label: "Sale price", get: (p) => p.listingType === "buy" ? formatPrice(p.price, { compact: false }) : "—", better: "low", raw: (p) => p.listingType === "buy" ? p.price : NaN },
  { label: "Monthly rent", get: (p) => p.listingType === "rent" && p.rentMonthly != null ? formatRent(p.rentMonthly) : "—", better: "low", raw: (p) => p.listingType === "rent" ? p.rentMonthly ?? NaN : NaN },
  { label: "Security deposit", get: (p) => p.listingType === "rent" && p.deposit != null ? formatPrice(p.deposit, { compact: false }) : "—" },
  { label: "Price per sq.ft", get: (p) => p.listingType === "buy" ? formatPriceSqft(p.pricePerSqft) : "—", better: "low", raw: (p) => p.listingType === "buy" ? p.pricePerSqft : NaN },
  { label: "Built-up area", get: (p) => p.propertyType === "plot" ? "—" : formatArea(p.builtupAreaSqft), better: "high", raw: (p) => p.propertyType === "plot" ? NaN : p.builtupAreaSqft },
  { label: "Plot area", get: (p) => p.propertyType === "plot" ? formatArea(p.builtupAreaSqft) : "—" },
  { label: "Super built-up area", get: (p) => p.superBuiltupAreaSqft ? formatArea(p.superBuiltupAreaSqft) : "—" },
  { label: "Carpet area", get: (p) => p.propertyType === "plot" ? "—" : formatArea(p.carpetAreaSqft), better: "high", raw: (p) => p.propertyType === "plot" ? NaN : p.carpetAreaSqft },
  { label: "Bedrooms", get: (p) => (p.bedrooms ? String(p.bedrooms) : "—") },
  { label: "Bathrooms", get: (p) => (p.bathrooms ? String(p.bathrooms) : "—") },
  { label: "Parking spaces", get: (p) => p.propertyType === "plot" ? "—" : String(p.parking) },
  { label: "Type", get: (p) => propertyTypeLabel(p.propertyType) },
  { label: "Possession", get: (p) => possessionLabel(p.possession) },
  { label: "Furnishing", get: (p) => furnishingLabel(p.furnishing) },
  { label: "Facing", get: (p) => p.facing },
  { label: "Floor", get: (p) => (p.floor ? `${p.floor} of ${p.totalFloors}` : "Ground") },
  { label: "Maintenance", get: (p) => `₹${p.maintenanceMonthly.toLocaleString("en-IN")}/mo`, better: "low", raw: (p) => p.maintenanceMonthly },
  { label: "RERA", get: (p) => p.reraNumber ?? "Not listed" },
];

export function CompareView() {
  const { compareIds, toggleCompare, clearCompare, setAssistantOpen, setAssistantDraft } = useDiscovery();
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const hydrated = useStoreHydrated();
  const { data, isLoading, isError, refetch } = usePropertiesByIds(compareIds);
  const items: Property[] | null =
    !hydrated || (compareIds.length > 0 && isLoading) ? null : (data?.items ?? []);

  if (items === null) {
    return (
      <div className="mx-auto max-w-[1240px] px-5 py-14 md:px-8">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError) {
    return <div className="mx-auto max-w-[720px] px-5 py-16">
      <h1 className="display text-3xl">Couldn’t load the comparison</h1>
      <Button className="mt-4" onClick={() => void refetch()}>Try again</Button>
    </div>;
  }

  const missing = compareIds.filter((id) => !items.some((item) => item.id === id));
  if (!items.length) {
    return (
      <div className="mx-auto max-w-[720px] px-5 py-24 text-center md:px-8">
        <h1 className="display text-[36px] text-ink">Nothing to compare yet.</h1>
        <p className="mx-auto mt-3 max-w-[44ch] text-[15px] leading-relaxed text-muted">
          Add up to four homes from the map or a listing, and PropIT will lay them out side by side —
          with prices, areas, configurations and amenities.
        </p>
        {missing.length > 0 && <Button className="mt-4" onClick={clearCompare}>Clear unavailable selections</Button>}
        <Link
          href="/search"
          className="mt-6 inline-flex h-11 items-center rounded-[var(--r-pill)] bg-accent px-5 text-[15px] font-medium text-[var(--accent-ink)]"
        >
          Find homes
        </Link>
      </div>
    );
  }

  const { best, allAmenities } = computeBest(items);
  const hideMatches = differencesOnly && items.length > 1;
  const visibleRows = ROWS.filter((row) => {
    const values = items.map(row.get);
    return values.some((value) => value !== "—") && (!hideMatches || new Set(values).size > 1);
  });
  const visibleAmenities = allAmenities.filter((amenity) =>
    !hideMatches || !items.every((item) => item.amenities.includes(amenity)),
  );

  return (
    <div className="mx-auto max-w-[1240px] px-5 py-14 md:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Comparison</p>
          <h1 className="display text-[36px] leading-tight text-ink md:text-[44px]">
            {items.length === 1 ? "1 property selected" : `Compare ${items.length} properties`}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="md" className="gap-1.5" disabled={items.length < 2} onClick={() => { setAssistantDraft("Compare my selected properties"); setAssistantOpen(true); }}>
            <MessageCircle size={14} strokeWidth={1.75} />
            Ask PropIT
          </Button>
          <Button variant="secondary" size="md" onClick={clearCompare}>
            Clear all
          </Button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        <Link href="/search" className="font-semibold text-accent hover:underline">Browse more properties</Link>
        {items.length > 1 && <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={differencesOnly} onChange={(event) => setDifferencesOnly(event.target.checked)} />
          Show differences only
        </label>}
      </div>
      {missing.length > 0 && <p role="status" className="mb-4 text-sm text-muted">
        {missing.length} selected {missing.length === 1 ? "property is" : "properties are"} unavailable.{" "}
        <button type="button" className="text-accent underline" onClick={() => missing.forEach(toggleCompare)}>Remove unavailable selections</button>
      </p>}
      {items.length > 1 && <p className="mb-2 text-xs text-muted sm:hidden">Swipe the table to see more properties.</p>}
      {hideMatches && !visibleRows.length && !visibleAmenities.length && <p className="mb-4 text-sm text-muted">These properties match on the available fields.</p>}
      <div className="overflow-x-auto scroll-quiet rounded-xl border border-line" tabIndex={0} role="region" aria-label="Property comparison table">
        <table className="w-full border-separate border-spacing-0" style={{ minWidth: 120 + items.length * 200 }}>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-[120px] bg-paper px-3 text-left text-xs">Property</th>
              {items.map((p) => (
                <th scope="col" key={p.id} className="p-2 align-top" style={{ width: `${80 / items.length}%` }}>
                  <div className="relative">
                    <Link href={`/property/${p.slug}`}>
                      <Img
                        src={p.images[0]?.url ?? ""}
                        alt={p.title}
                        seed={p.id}
                        className="aspect-[4/3] w-full rounded-[var(--r-md)]"
                        sizes="300px"
                      />
                    </Link>
                    <button
                      onClick={() => toggleCompare(p.id)}
                      className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-[color-mix(in_srgb,var(--paper-raised)_88%,transparent)] text-ink backdrop-blur"
                      aria-label={`Remove ${p.title}`}
                    >
                      <X size={13} strokeWidth={2} />
                    </button>
                  </div>
                  <Link
                    href={`/property/${p.slug}`}
                    className="mt-2.5 block text-left text-[14px] font-medium leading-snug text-ink hover:text-accent"
                  >
                    {p.title}
                  </Link>
                  <p className="mt-1 text-left text-[12px] font-normal text-faint">{p.address}</p>
                  <div className="mt-1.5 flex">
                    <QualityBadge quality={p.dataQuality} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.label} className="[&>*]:border-t [&>*]:border-line">
                <th scope="row" className="sticky left-0 z-10 bg-paper px-3 py-3 text-left text-[13px] font-normal text-faint">
                  {row.label}
                </th>
                {items.map((p) => {
                  const isBest = best.get(row.label) === p.id;
                  return (
                    <td
                      key={p.id}
                      className={cn(
                        "tnum px-2 py-3 text-[14px]",
                        isBest ? "font-semibold text-accent" : "text-ink",
                      )}
                    >
                      {row.get(p)}
                      {isBest && <span className="ml-1.5 text-[10px] font-normal">{row.better === "low" ? "Lowest" : "Largest"}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            {visibleAmenities.map((amenity) => (
              <tr key={amenity} className="[&>*]:border-t [&>*]:border-line">
                <th scope="row" className="sticky left-0 z-10 bg-paper px-3 py-2 text-left text-xs font-medium text-muted">
                  {AMENITY_BY_SLUG.get(amenity as never)?.name ?? amenity}
                </th>
                {items.map((property) => (
                  <td key={property.id} className="px-2 py-2 text-xs text-muted">
                    {property.amenities.includes(amenity)
                      ? <span className="inline-flex items-center gap-1 text-accent"><Check size={13} aria-hidden="true" /> Listed</span>
                      : "Not listed"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>


    </div>
  );
}
