"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Check, MapPin, MessageCircle, Plus, Scale, X } from "lucide-react";
import { MAX_COMPARE_PROPERTIES, useDiscovery } from "@/store/discovery";
import { ComparePicker } from "@/components/compare/compare-picker";
import { Img } from "@/components/ui/img";
import { QualityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompareProperties } from "@/lib/hooks/use-properties";
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

const GROUPS = ["All details", "Costs", "Space", "Property details", "Amenities"] as const;
type Group = typeof GROUPS[number];

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

const COST_ROWS = new Set(["Sale price", "Monthly rent", "Security deposit", "Price per sq.ft", "Maintenance"]);
const SPACE_ROWS = new Set(["Built-up area", "Plot area", "Super built-up area", "Carpet area", "Bedrooms", "Bathrooms", "Parking spaces"]);

function groupFor(row: Row): Group {
  if (COST_ROWS.has(row.label)) return "Costs";
  if (SPACE_ROWS.has(row.label)) return "Space";
  return "Property details";
}

export function CompareView() {
  const { compareIds, toggleCompare, clearCompare, setAssistantOpen, setAssistantDraft } = useDiscovery();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [group, setGroup] = useState<Group>("All details");
  const hydrated = useStoreHydrated();
  const { items, missing, pending, failed, retry } = useCompareProperties(compareIds);
  const busy = !hydrated || (pending && !items.length);
  const full = compareIds.length >= MAX_COMPARE_PROPERTIES;
  const { best, allAmenities } = computeBest(items);
  const hideMatches = differencesOnly && items.length > 1;
  const visibleRows = ROWS.filter((row) => {
    if (group !== "All details" && group !== groupFor(row)) return false;
    const values = items.map(row.get);
    return values.some((value) => value !== "—") && (!hideMatches || new Set(values).size > 1);
  });
  const visibleAmenities = group === "All details" || group === "Amenities"
    ? allAmenities.filter((amenity) => !hideMatches || !items.every((item) => item.amenities.includes(amenity)))
    : [];
  const needsSecond = items.length === 1 && !full;

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-24 pt-5 sm:px-8 sm:pt-8">
      <header className="relative isolate overflow-hidden rounded-3xl border border-[#456051] bg-[#19362b] px-4 py-5 text-[#fffaf0] shadow-e2 sm:px-7 sm:py-7">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,#4b6c51_0%,transparent_62%)]" />
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#d6e3d8]">
              <Scale size={16} aria-hidden="true" /> Property comparison
            </p>
            <h1 className="font-[family-name:var(--font-editorial)] text-[clamp(34px,5vw,54px)] leading-none tracking-tight">
              Compare properties
            </h1>
            <p className="mt-2 max-w-[52ch] text-sm text-[#d6e3d8]">
              Compare price, space and amenities for up to {MAX_COMPARE_PROPERTIES} listings.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {items.length >= 2 && (
              <Button variant="ghost" className="border border-white/25 text-[#fffaf0] hover:bg-white/10"
                onClick={() => { setAssistantDraft("Compare my selected properties"); setAssistantOpen(true); }}>
                <MessageCircle size={15} aria-hidden="true" /> Ask PropIT
              </Button>
            )}
            <Button variant="primary" type="button" disabled={!hydrated || full}
              aria-haspopup="dialog" onClick={() => setPickerOpen(true)}
              className="bg-[#f1d8a6] font-semibold text-[#21352a] hover:bg-[#ffe7b9]">
              <Plus size={17} aria-hidden="true" /> Add property
            </Button>
          </div>
        </div>
      </header>

      <div className="my-4 flex flex-wrap items-center justify-between gap-2 px-0.5">
        <p role="status" className="text-sm font-semibold">
          {hydrated ? `${compareIds.length} of ${MAX_COMPARE_PROPERTIES} selected` : "Loading your selection…"}
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold sm:gap-5">
          <Link href="/search" className="inline-flex items-center gap-1 text-accent hover:underline">Browse map <ArrowRight size={13} aria-hidden="true" /></Link>
          {hydrated && compareIds.length > 0 && <button type="button" className="min-h-9 text-muted hover:text-ink hover:underline" onClick={clearCompare}>Clear all</button>}
        </div>
      </div>
      {full && hydrated && <p className="mb-3 text-xs text-muted">Comparison full. Remove a property to add another.</p>}
      {missing.length > 0 && (
        <p role="status" className="mb-4 text-sm text-muted">
          {missing.length} selected {missing.length === 1 ? "property is" : "properties are"} unavailable.{" "}
          <button type="button" className="text-accent underline" onClick={() => missing.forEach(toggleCompare)}>Remove unavailable selections</button>
        </p>
      )}
      {pending && items.length > 0 && <p role="status" className="mb-3 text-xs text-muted">Loading a selected property…</p>}
      {failed && items.length > 0 && <p role="status" className="mb-3 text-xs text-muted">
        A selected property couldn’t load.{" "}
        <button type="button" className="text-accent underline" onClick={() => void retry()}>Try again</button>
      </p>}
      {busy ? (
        <Skeleton className="h-56 w-full rounded-2xl" />
      ) : failed && !items.length ? (
        <div className="rounded-2xl border border-line bg-raised p-5">
          <p className="text-sm font-semibold">Couldn’t load the comparison.</p>
          <Button size="sm" className="mt-3" onClick={() => void retry()}>Try again</Button>
        </div>
      ) : !items.length ? (
        <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-line-strong bg-raised p-6 text-center">
          <div>
            <span className="mx-auto grid size-11 place-items-center rounded-full bg-accent-wash text-accent"><Building2 size={21} aria-hidden="true" /></span>
            <h2 className="mt-3 text-[19px] font-semibold tracking-tight">Start with a property</h2>
            <p className="mt-1 text-sm text-muted">Search by listing name, project or locality.</p>
            {!full && <Button type="button" className="mt-3" onClick={() => setPickerOpen(true)}><Plus size={15} aria-hidden="true" /> Add first property</Button>}
          </div>
        </div>
      ) : (
        <>
          {items.length > 1 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div role="group" aria-label="Comparison sections" className="flex max-w-full flex-wrap gap-1.5">
                {GROUPS.map((option) => (
                  <button type="button" key={option} aria-pressed={group === option} onClick={() => setGroup(option)}
                    className="min-h-9 rounded-full border border-line bg-raised px-3 text-xs font-semibold text-muted hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent-wash aria-pressed:text-accent">
                    {option}
                  </button>
                ))}
              </div>
              <label className="inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-muted">
                <input type="checkbox" checked={differencesOnly} className="size-4 accent-accent" onChange={(event) => setDifferencesOnly(event.target.checked)} />
                Differences only
              </label>
            </div>
          )}
          {items.length > 1 && <p className="mb-2 text-xs text-muted sm:hidden">Swipe to compare all selected properties.</p>}
          <div className={cn("scroll-quiet overflow-x-auto rounded-2xl border border-line bg-raised", items.length === 1 && "max-w-[850px]")} tabIndex={0} role="region" aria-label="Property comparison table">
            <table className="w-full table-fixed border-separate border-spacing-0"
              style={{ minWidth: 100 + (items.length + Number(needsSecond)) * 177 }}>
              <colgroup>
                <col className="w-[100px] sm:w-[155px]" />
                {items.map((property) => <col key={property.id} />)}
                {needsSecond && <col />}
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 bg-paper px-2.5 py-3 text-left align-bottom text-xs font-semibold text-muted sm:px-4">Property</th>
                  {items.map((property) => (
                    <th scope="col" key={property.id} className="border-l border-line p-2 text-left align-top sm:p-3">
                      <ComparisonCard property={property} onRemove={() => toggleCompare(property.id)} />
                    </th>
                  ))}
                  {needsSecond && (
                    <th scope="col" className="border-l border-line p-2 align-top sm:p-3">
                      <button type="button" aria-haspopup="dialog" onClick={() => setPickerOpen(true)}
                        className="grid h-[116px] w-full place-items-center rounded-xl border border-dashed border-line-strong bg-paper px-2 text-accent hover:border-accent hover:bg-accent-wash sm:h-[154px]">
                        <span className="grid justify-items-center gap-1.5 text-xs font-semibold">
                          <span className="grid size-8 place-items-center rounded-full bg-accent-wash"><Plus size={16} aria-hidden="true" /></span>
                          Add another property
                        </span>
                      </button>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.label} className="[&>*]:border-t [&>*]:border-line">
                    <th scope="row" className="sticky left-0 z-10 bg-paper px-2.5 py-2.5 text-left text-xs font-medium text-muted sm:px-4">
                      {row.label}
                    </th>
                    {items.map((property) => {
                      const isBest = best.get(row.label) === property.id;
                      return (
                        <td key={property.id} className={cn("tnum border-l px-2.5 py-2.5 text-sm sm:px-4", isBest && "bg-accent-wash/55 font-semibold text-accent")}>
                          {row.get(property)}
                          {isBest && <span className="mt-0.5 block text-[10px] font-medium">{row.better === "low" ? "Lowest" : "Largest"}</span>}
                        </td>
                      );
                    })}
                    {needsSecond && <td className="border-l bg-paper/75" />}
                  </tr>
                ))}
                {visibleAmenities.map((amenity) => (
                  <tr key={amenity} className="[&>*]:border-t [&>*]:border-line">
                    <th scope="row" className="sticky left-0 z-10 bg-paper px-2.5 py-2.5 text-left text-xs font-medium text-muted sm:px-4">
                      {AMENITY_BY_SLUG.get(amenity as never)?.name ?? amenity}
                    </th>
                    {items.map((property) => (
                      <td key={property.id} className="border-l px-2.5 py-2.5 text-xs text-muted sm:px-4">
                        {property.amenities.includes(amenity)
                          ? <span className="inline-flex items-center gap-1 text-accent"><Check size={13} aria-hidden="true" /> Listed</span>
                          : "Not listed"}
                      </td>
                    ))}
                    {needsSecond && <td className="border-l bg-paper/75" />}
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleRows.length && !visibleAmenities.length && (
              <p role="status" className="border-t border-line px-3 py-4 text-sm text-muted">
                {hideMatches ? "No differences in this section." : "No details are listed in this section."}
              </p>
            )}
          </div>
        </>
      )}
      {pickerOpen && <ComparePicker onClose={() => setPickerOpen(false)} />}
    </div>
  );
}

function ComparisonCard({ property, onRemove }: { property: Property; onRemove: () => void }) {
  const href = `/property/${property.slug}`;
  const price = property.listingType === "buy" ? formatPrice(property.price)
    : property.rentMonthly == null ? "Rent on request" : formatRent(property.rentMonthly);

  return (
    <article className="relative">
      <Link href={href} className="group block rounded-xl" aria-label={`View ${property.title}`}>
        <Img src={property.images[0]?.url ?? ""} alt="" seed={property.id}
          className="h-[116px] w-full rounded-xl sm:h-[154px] [&_img]:duration-300 motion-safe:[&_img]:group-hover:scale-[1.025]" sizes="(max-width: 640px) 185px, 340px" />
        <span className="absolute left-2 top-2 rounded-full bg-[#19362b] px-2 py-1 text-[10px] font-semibold text-white">
          {property.listingType === "buy" ? "For sale" : "For rent"}
        </span>
        <span className="mt-2 block text-[14px] font-semibold leading-tight group-hover:text-accent">{property.title}</span>
      </Link>
      <button type="button" onClick={onRemove} aria-label={`Remove ${property.title}`}
        className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-raised text-ink shadow-e1 transition-colors hover:bg-sunk">
        <X size={15} aria-hidden="true" />
      </button>
      <p className="mt-1 flex items-start gap-1 text-xs font-normal text-muted">
        <MapPin size={12} className="mt-0.5 shrink-0" aria-hidden="true" /> {property.address}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <strong className="tnum text-[17px] font-semibold tracking-tight text-accent">{price}</strong>
        <QualityBadge quality={property.dataQuality} />
      </div>
    </article>
  );
}
