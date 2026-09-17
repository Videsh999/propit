"use client";

import Link from "next/link";
import { Bath, BedDouble, Car, Heart, Scale } from "lucide-react";
import { Img } from "@/components/ui/img";
import { QualityBadge } from "@/components/ui/badge";
import { useDiscovery } from "@/store/discovery";
import { formatArea, formatPrice, formatPriceSqft, formatRent, propertyTypeLabel } from "@/lib/format";
import { fitLabel } from "@/lib/scoring/fit";
import type { ScoredProperty } from "@/types";
import { cn } from "@/lib/utils";

export function PropertyCard({
  property,
  localityName,
  compact = false,
}: {
  property: ScoredProperty;
  localityName?: string;
  compact?: boolean;
}) {
  const { hover, select, hoveredPropertyId, selectedPropertyId, toggleSaved, savedIds, toggleCompare, compareIds, flyTo } =
    useDiscovery();
  const isHovered = hoveredPropertyId === property.id;
  const isSelected = selectedPropertyId === property.id;
  const isSaved = savedIds.includes(property.id);
  const inCompare = compareIds.includes(property.id);
  const hasAnchors = property.fitBreakdown.length > 0;
  const fit = fitLabel(property.fitScore);

  const priceLabel =
    property.listingType === "rent" && property.rentMonthly
      ? formatRent(property.rentMonthly)
      : formatPrice(property.price);

  return (
    <article
      onMouseEnter={() => hover(property.id)}
      onMouseLeave={() => hover(null)}
      onClick={() => {
        select(property.id, property);
        flyTo(property.location, 15.2, -180);
      }}
      className={cn(
        "group relative cursor-pointer border-b border-line px-4 py-4 transition-colors duration-[160ms]",
        isSelected ? "bg-[var(--accent-wash)]" : isHovered ? "bg-sunk" : "bg-transparent",
      )}
    >
      <div className={cn("flex gap-4", compact && "gap-3")}>
        <Img
          src={property.images[0]?.url ?? ""}
          alt={property.title}
          seed={property.id}
          className={cn("shrink-0 rounded-[var(--r-md)]", compact ? "h-20 w-24" : "h-28 w-36")}
          sizes="160px"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-medium leading-snug text-ink">
                <Link
                  href={`/property/${property.slug}`}
                  onClick={(e) => e.stopPropagation()}
                  className="underline-offset-4 hover:underline"
                >
                  {property.title}
                </Link>
              </h3>
              <p className="mt-0.5 truncate text-[13px] text-muted">
                {localityName ?? property.address}
              </p>
            </div>
            {hasAnchors && (
              <span
                title={`Fit ${property.fitScore}`}
                className={cn(
                  "tnum shrink-0 rounded-[var(--r-sm)] border px-1.5 py-0.5 text-[11px] font-semibold",
                  fit.tone === "strong"
                    ? "border-[var(--accent-line)] bg-[var(--accent-wash)] text-accent"
                    : fit.tone === "good"
                      ? "border-line bg-sunk text-ink"
                      : "border-line bg-transparent text-faint",
                )}
              >
                {property.fitScore}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="tnum text-[17px] font-semibold tracking-tight text-ink">{priceLabel}</span>
            <span className="tnum text-[12px] text-faint">{formatPriceSqft(property.pricePerSqft)}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
            {property.bedrooms > 0 && (
              <span className="inline-flex items-center gap-1">
                <BedDouble size={12} strokeWidth={1.75} /> {property.bedrooms}
              </span>
            )}
            {property.bathrooms > 0 && (
              <span className="inline-flex items-center gap-1">
                <Bath size={12} strokeWidth={1.75} /> {property.bathrooms}
              </span>
            )}
            {property.parking > 0 && (
              <span className="inline-flex items-center gap-1">
                <Car size={12} strokeWidth={1.75} /> {property.parking}
              </span>
            )}
            <span className="tnum">{formatArea(property.builtupAreaSqft)}</span>
            <span className="text-faint">{propertyTypeLabel(property.propertyType)}</span>
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            <QualityBadge quality={property.dataQuality} />
            <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity duration-[160ms] group-hover:opacity-100 focus-within:opacity-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCompare(property.id);
                }}
                aria-label={inCompare ? "Remove from comparison" : "Add to comparison"}
                aria-pressed={inCompare}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-[var(--r-sm)] border transition-colors",
                  inCompare
                    ? "border-[var(--accent-line)] bg-[var(--accent-wash)] text-accent"
                    : "border-line bg-raised text-faint hover:text-ink",
                )}
              >
                <Scale size={13} strokeWidth={1.75} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSaved(property.id);
                }}
                aria-label={isSaved ? "Remove from saved" : "Save this home"}
                aria-pressed={isSaved}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-[var(--r-sm)] border transition-colors",
                  isSaved
                    ? "border-[var(--accent-line)] bg-[var(--accent-wash)] text-accent"
                    : "border-line bg-raised text-faint hover:text-ink",
                )}
              >
                <Heart size={13} strokeWidth={1.75} fill={isSaved ? "currentColor" : "none"} />
              </button>
            </div>
          </div>

          {hasAnchors && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-line pt-2 text-[11px] text-faint">
              {property.fitBreakdown.map((b) => (
                <span key={b.anchorId} className="tnum">
                  {b.label} {b.distanceKm} km
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
