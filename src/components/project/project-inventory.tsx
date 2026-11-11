"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CompareToggle } from "@/components/compare/compare-toggle";
import { Img } from "@/components/ui/img";
import { formatArea, formatPrice, formatRent, propertyTypeLabel } from "@/lib/format";
import type { ListingType, Property, PropertyType } from "@/types";

export type ProjectListing = Pick<Property, "id" | "slug" | "title" | "listingType" | "propertyType" |
  "price" | "rentMonthly" | "bedrooms" | "builtupAreaSqft"> & { image?: string };

export function ProjectInventory({ listings }: { listings: ProjectListing[] }) {
  const [mode, setMode] = useState<ListingType>("buy");
  const [type, setType] = useState<PropertyType | "">("");
  const active = listings.filter((listing) => listing.listingType === mode);
  const types = [...new Set(active.map((listing) => listing.propertyType))];
  const results = type ? active.filter((listing) => listing.propertyType === type) : active;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div role="group" aria-label="Listing intent" className="flex gap-1 rounded-full border border-line bg-raised p-1">
          {(["buy", "rent"] as const).map((option) => (
            <button key={option} type="button" aria-pressed={mode === option}
              onClick={() => { setMode(option); setType(""); }}
              className="rounded-full px-3 py-1.5 text-sm text-muted aria-pressed:bg-accent aria-pressed:text-accent-ink">
              {option === "buy" ? "Buy" : "Rent"} · {listings.filter((listing) => listing.listingType === option).length}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          Property type
          <select value={type} onChange={(event) => setType(event.target.value as PropertyType | "")}
            className="rounded-lg border border-line bg-raised px-2 py-2 text-ink">
            <option value="">All types</option>
            {types.map((option) => <option key={option} value={option}>{propertyTypeLabel(option)}</option>)}
          </select>
        </label>
      </div>
      {results.length ? (
        <ul className="divide-y divide-line">
          {results.map((listing) => (
            <li key={listing.id} className="flex items-center gap-2">
              <Link href={`/property/${listing.slug}`} className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 py-3 hover:text-accent sm:flex sm:gap-4">
                {listing.image && <Img src={listing.image} alt="" className="row-span-2 h-14 w-14 shrink-0 rounded-lg sm:w-20" sizes="80px" />}
                <span className="col-start-2 min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{listing.title}</span>
                  <span className="text-xs text-muted">{propertyTypeLabel(listing.propertyType)} · {formatArea(listing.builtupAreaSqft)}</span>
                </span>
                <span className="col-start-2 shrink-0 text-xs font-semibold sm:text-right sm:text-sm">
                  {mode === "rent" ? listing.rentMonthly == null ? "On request" : formatRent(listing.rentMonthly) : formatPrice(listing.price)}
                </span>
                <ArrowUpRight size={15} className="hidden shrink-0 sm:block" aria-hidden="true" />
              </Link>
              <CompareToggle id={listing.id} compact />
            </li>
          ))}
        </ul>
      ) : <p role="status" className="mt-4 text-sm text-muted">No {mode === "buy" ? "sale" : "rental"} listings for this selection.</p>}
    </>
  );
}
