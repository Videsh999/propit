"use client";

import { useState } from "react";
import Link from "next/link";
import { BedDouble, ChevronDown, Ruler } from "lucide-react";
import { CompareToggle } from "@/components/compare/compare-toggle";
import { Img } from "@/components/ui/img";
import { formatArea, formatPrice, formatRent, propertyTypeLabel } from "@/lib/format";
import { configurationLabel, filterProjectListings, type ProjectListing, type ProjectSort } from "@/lib/data/project-presentation";
import type { ListingType, PropertyType } from "@/types";

export function ProjectInventory({ listings, configurations: offered = [] }: { listings: ProjectListing[]; configurations?: string[] }) {
  const [mode, setMode] = useState<ListingType>("buy");
  const [type, setType] = useState<PropertyType | "">("");
  const [configuration, setConfiguration] = useState("");
  const [sort, setSort] = useState<ProjectSort>("price_asc");
  const [expanded, setExpanded] = useState(false);
  const active = listings.filter(listing => listing.listingType === mode);
  const types = [...new Set(active.map(listing => listing.propertyType))];
  const scoped = type ? active.filter(listing => listing.propertyType === type) : active;
  const configurations = [...new Set([...offered, ...scoped.map(configurationLabel)])].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const results = filterProjectListings(listings, { mode, type, configuration, sort });
  const shown = expanded ? results : results.slice(0, 6);

  return <div>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div role="group" aria-label="Listing intent" className="inline-flex rounded-full border border-line bg-paper p-1">
        {(["buy", "rent"] as const).map(option => <button key={option} type="button" aria-pressed={mode === option} onClick={() => { setMode(option); setType(""); setConfiguration(""); setExpanded(false); }} className="min-h-11 rounded-full px-5 text-[14px] font-semibold text-muted transition-colors aria-pressed:bg-accent aria-pressed:text-accent-ink">
          {option === "buy" ? "Buy" : "Rent"} <span className="ml-1 opacity-80">{listings.filter(listing => listing.listingType === option).length}</span>
        </button>)}
      </div>
      <div className="flex max-w-full flex-wrap gap-3">
        <Select label="Property type" value={type} onChange={value => { setType(value as PropertyType | ""); setConfiguration(""); setExpanded(false); }}>
          <option value="">All types</option>{types.map(option => <option key={option} value={option}>{propertyTypeLabel(option)}</option>)}
        </Select>
        <Select label="Sort listings" value={sort} onChange={value => { setSort(value as ProjectSort); setExpanded(false); }}>
          <option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="area_desc">Largest first</option>
        </Select>
      </div>
    </div>
    <div role="group" aria-label="Listing configurations" className="mt-5 flex gap-5 overflow-x-auto border-b border-line">
      {["", ...configurations].map(option => <button type="button" key={option} aria-pressed={configuration === option} onClick={() => { setConfiguration(option); setExpanded(false); }} className="flex min-h-12 shrink-0 items-center gap-2 border-b-2 border-transparent px-1 text-[14px] font-semibold text-muted transition-colors aria-pressed:border-accent aria-pressed:text-accent">
        {option || "All homes"}<span className="rounded-full bg-sunk px-2 py-0.5 text-xs">{option ? scoped.filter(listing => configurationLabel(listing) === option).length : scoped.length}</span>
      </button>)}
    </div>
    <p role="status" className="my-4 text-xs text-muted">{results.length ? `Showing ${shown.length} of ${results.length} ${mode === "buy" ? "sale" : "rental"} listings` : `No ${mode === "buy" ? "sale" : "rental"} listings for this selection.`}</p>
    {results.length ? <>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map(listing => <li key={listing.id} className="group relative overflow-hidden rounded-2xl border border-line bg-raised transition-shadow hover:shadow-e2">
          <Link href={`/property/${listing.slug}`} className="block h-full">
            <div className="relative"><Img src={listing.image ?? ""} alt={listing.title} className="aspect-[16/10] w-full" sizes="(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 33vw" /><span className="absolute bottom-3 left-3 rounded-full bg-raised/95 px-3 py-1.5 text-xs font-medium">{mode === "buy" ? "For sale" : "For rent"}</span></div>
            <div className="p-4"><p className="text-xl font-semibold tracking-tight">{mode === "rent" ? listing.rentMonthly == null ? "On request" : formatRent(listing.rentMonthly) : listing.price > 0 ? formatPrice(listing.price) : "On request"}</p><h3 className="mt-2 text-[16px] font-semibold leading-snug group-hover:text-accent">{listing.title}</h3><p className="mt-1 text-[14px] text-muted">{propertyTypeLabel(listing.propertyType)}</p>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-3 text-[14px] text-muted"><span className="flex items-center gap-1.5"><BedDouble size={15} />{configurationLabel(listing)}</span><span className="flex items-center gap-1.5"><Ruler size={15} />{formatArea(listing.builtupAreaSqft)}</span></div>
            </div>
          </Link>
          <div className="absolute right-3 top-3"><CompareToggle id={listing.id} compact className="min-h-11 min-w-11 border-line bg-raised/95 shadow-e1" /></div>
        </li>)}
      </ul>
      {results.length > 6 && <button type="button" onClick={() => setExpanded(value => !value)} className="mx-auto mt-5 flex min-h-11 items-center rounded-full border border-line bg-paper px-6 text-[14px] font-semibold text-accent">{expanded ? "Show fewer homes" : `Show all ${results.length} homes`}</button>}
    </> : <div className="rounded-2xl border border-dashed border-line bg-paper p-8 text-center"><p className="text-[14px] text-muted">Try another configuration or switch between Buy and Rent.</p><button type="button" onClick={() => { setType(""); setConfiguration(""); }} className="mt-3 min-h-11 rounded-full border border-line px-5 text-[14px] font-semibold text-accent">Reset listing filters</button></div>}
  </div>;
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="block max-w-full text-xs text-muted"><span className="mb-1 block">{label}</span><span className="relative block"><select aria-label={label} value={value} onChange={event => onChange(event.target.value)} className="min-h-11 max-w-full appearance-none rounded-xl border border-line bg-paper pl-3 pr-9 text-[14px] text-ink">{children}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" /></span></label>;
}
