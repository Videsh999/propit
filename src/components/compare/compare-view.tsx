"use client";

import Link from "next/link";
import { X, Sparkles } from "lucide-react";
import { useDiscovery } from "@/store/discovery";
import { Img } from "@/components/ui/img";
import { QualityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePropertiesByIds } from "@/lib/hooks/use-properties";
import { useStoreHydrated } from "@/lib/hooks/use-hydrated";
import { AMENITY_BY_SLUG } from "@/lib/data/developers";
import {
  formatArea, formatPrice, formatPriceSqft, furnishingLabel, possessionLabel, propertyTypeLabel,
} from "@/lib/format";
import type { Property } from "@/types";
import { cn } from "@/lib/utils";

/** Best value per row, computed across the selected homes only. */
function computeBest(items: Property[]) {
  const best = new Map<string, string>();
  for (const row of ROWS) {
    if (!row.better || !row.raw) continue;
    const raw = row.raw;
    const sorted = [...items].sort((a, b) =>
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
  { label: "Price", get: (p) => formatPrice(p.price), better: "low", raw: (p) => p.price },
  { label: "Price per sq.ft", get: (p) => formatPriceSqft(p.pricePerSqft), better: "low", raw: (p) => p.pricePerSqft },
  { label: "Built-up area", get: (p) => formatArea(p.builtupAreaSqft), better: "high", raw: (p) => p.builtupAreaSqft },
  { label: "Carpet area", get: (p) => formatArea(p.carpetAreaSqft), better: "high", raw: (p) => p.carpetAreaSqft },
  { label: "Bedrooms", get: (p) => (p.bedrooms ? String(p.bedrooms) : "—") },
  { label: "Bathrooms", get: (p) => (p.bathrooms ? String(p.bathrooms) : "—") },
  { label: "Parking", get: (p) => (p.parking ? String(p.parking) : "—") },
  { label: "Type", get: (p) => propertyTypeLabel(p.propertyType) },
  { label: "Possession", get: (p) => possessionLabel(p.possession) },
  { label: "Furnishing", get: (p) => furnishingLabel(p.furnishing) },
  { label: "Facing", get: (p) => p.facing },
  { label: "Floor", get: (p) => (p.floor ? `${p.floor} of ${p.totalFloors}` : "Ground") },
  { label: "Maintenance", get: (p) => `₹${p.maintenanceMonthly.toLocaleString("en-IN")}/mo`, better: "low", raw: (p) => p.maintenanceMonthly },
  { label: "RERA", get: (p) => p.reraNumber ?? "Not listed" },
];

export function CompareView() {
  const { compareIds, toggleCompare, clearCompare, setAssistantOpen } = useDiscovery();
  const hydrated = useStoreHydrated();
  const { data, isLoading } = usePropertiesByIds(compareIds);
  const items: Property[] | null =
    !hydrated || (compareIds.length > 0 && isLoading) ? null : (data?.items ?? []);

  if (items === null) {
    return (
      <div className="mx-auto max-w-[1240px] px-5 py-14 md:px-8">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="mx-auto max-w-[720px] px-5 py-24 text-center md:px-8">
        <h1 className="display text-[36px] text-ink">Nothing to compare yet.</h1>
        <p className="mx-auto mt-3 max-w-[44ch] text-[15px] leading-relaxed text-muted">
          Add up to four homes from the map or a listing, and PropIT will lay them out side by side —
          price, area, configuration and what&apos;s around them.
        </p>
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

  return (
    <div className="mx-auto max-w-[1240px] px-5 py-14 md:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Comparison</p>
          <h1 className="display text-[36px] leading-tight text-ink md:text-[44px]">
            {items.length} homes, side by side.
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="md" className="gap-1.5" onClick={() => setAssistantOpen(true)}>
            <Sparkles size={14} strokeWidth={1.75} />
            Ask PropIT to weigh these up
          </Button>
          <Button variant="secondary" size="md" onClick={clearCompare}>
            Clear
          </Button>
        </div>
      </header>

      <div className="overflow-x-auto scroll-quiet">
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-[150px] bg-paper" />
              {items.map((p) => (
                <th key={p.id} className="p-2 align-top" style={{ width: `${80 / items.length}%` }}>
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
            {ROWS.map((row) => (
              <tr key={row.label} className="border-t border-line">
                <th className="sticky left-0 z-10 bg-paper py-3 pr-3 text-left text-[13px] font-normal text-faint">
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
                      {isBest && <span className="ml-1.5 text-[10px] font-normal">best</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t border-line">
              <th className="sticky left-0 z-10 bg-paper py-3 pr-3 text-left align-top text-[13px] font-normal text-faint">
                Amenities
              </th>
              {items.map((p) => (
                <td key={p.id} className="px-2 py-3 align-top">
                  <ul className="space-y-1">
                    {allAmenities.map((a) => {
                      const hasIt = p.amenities.includes(a);
                      return (
                        <li
                          key={a}
                          className={cn("text-[12px]", hasIt ? "text-ink" : "text-faint line-through")}
                        >
                          {AMENITY_BY_SLUG.get(a as never)?.name ?? a}
                        </li>
                      );
                    })}
                  </ul>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-6 max-w-[68ch] text-[12px] leading-relaxed text-faint">
        &ldquo;Best&rdquo; marks the strongest value among these homes on that measure alone — it is
        not a recommendation. Figures come from each listing; verified, listed and estimated data are
        badged differently above.
      </p>
    </div>
  );
}
