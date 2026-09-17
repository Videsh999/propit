"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { X, TrendingUp, ArrowUpRight } from "lucide-react";
import { useDiscovery } from "@/store/discovery";
import { useLocality } from "@/lib/hooks/use-locality";
import { Img } from "@/components/ui/img";
import { QualityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { POI_CATEGORY_LABEL } from "@/lib/data/pois";
import { formatCount, formatPrice, formatPriceSqft, formatRent, projectStatusLabel } from "@/lib/format";
import type { NearbyPlace, PoiCategory } from "@/types";

export function LocalityPanel() {
  const { selectedLocalitySlug, selectLocality, setFilters, setUseBounds, flyTo } = useDiscovery();
  const { data, isLoading, isError } = useLocality(selectedLocalitySlug);

  if (!selectedLocalitySlug) return null;

  return (
    <motion.aside
      initial={{ x: 32, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 32, opacity: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="scroll-quiet absolute right-3 top-3 z-30 flex max-h-[calc(100%-24px)] w-[420px] flex-col overflow-y-auto rounded-[var(--r-lg)] border border-line bg-raised shadow-[var(--e3)]"
      aria-label="Locality intelligence"
    >
      <button
        onClick={() => selectLocality(null)}
        className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-[color-mix(in_srgb,var(--paper-raised)_86%,transparent)] text-ink backdrop-blur transition-colors hover:bg-raised"
        aria-label="Close locality"
      >
        <X size={15} strokeWidth={2} />
      </button>

      {isLoading && (
        <div className="p-4">
          <Skeleton className="mb-4 h-40 w-full rounded-[var(--r-md)]" />
          <Skeleton className="mb-2 h-6 w-1/2" />
          <Skeleton className="mb-4 h-4 w-3/4" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </div>
      )}

      {isError && (
        <div className="p-6">
          <p className="text-[14px] text-ink">We don&apos;t have data for that locality yet.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => selectLocality(null)}>
            Close
          </Button>
        </div>
      )}

      {data && (
        <>
          <div className="relative">
            <Img
              src={data.locality.heroImage}
              alt={data.locality.name}
              seed={data.locality.slug}
              className="h-44 w-full"
              sizes="440px"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(0,0,0,0.72)] to-transparent p-4 pt-10">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/70">
                {data.locality.corridor}
              </p>
              <h2 className="display text-[30px] leading-tight text-white">{data.locality.name}</h2>
            </div>
          </div>

          <div className="px-5 py-4">
            <p className="text-[14px] leading-relaxed text-muted">{data.locality.character}.</p>

            <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-md)] border border-line bg-[var(--line)]">
              <Stat label="Average" value={formatPriceSqft(data.stats.avgPriceSqft)} />
              <Stat label="Median home" value={formatPrice(data.stats.medianPrice)} />
              <Stat label="Homes" value={formatCount(data.stats.inventory)} />
              <Stat label="Projects" value={formatCount(data.stats.projects)} />
              <Stat label="Rental yield" value={`${data.stats.rentalYieldPct}%`} />
              <Stat
                label="Year on year"
                value={`+${data.stats.momentumPct}%`}
                icon={<TrendingUp size={11} strokeWidth={2} className="text-[var(--accent)]" />}
              />
            </div>

            <div className="mt-2 flex items-center gap-2">
              <QualityBadge quality="estimated" label="PropIT estimate" />
              <span className="text-[11px] text-faint">Modelled from listed inventory</span>
            </div>

            <PriceTrend history={data.priceHistory} />

            <p className="mt-5 text-[14px] leading-relaxed text-muted">{data.locality.summary}</p>

            {data.stats.avgRent > 0 && (
              <p className="mt-3 text-[13px] text-muted">
                Typical rent here is{" "}
                <span className="tnum font-medium text-ink">{formatRent(data.stats.avgRent)}</span>.
              </p>
            )}

            {/* Connectivity */}
            {data.connectivity.length > 0 && (
              <>
                <h3 className="eyebrow mt-6">Connectivity</h3>
                <ul className="mt-2 space-y-1.5">
                  {data.connectivity.slice(0, 5).map((c) => (
                    <NearbyRow key={c.id} place={c} onGo={() => flyTo(c.location, 13.5)} />
                  ))}
                </ul>
              </>
            )}

            {/* What's nearby, grouped */}
            <h3 className="eyebrow mt-6">What&apos;s nearby</h3>
            <NearbyGroups places={data.nearby} onGo={(p) => flyTo(p.location, 14)} />

            {/* Projects */}
            {data.topProjects.length > 0 && (
              <>
                <h3 className="eyebrow mt-6">Projects here</h3>
                <ul className="mt-2 divide-y divide-[var(--line)] border-y border-line">
                  {data.topProjects.slice(0, 4).map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/project/${p.slug}`}
                        className="flex items-center gap-3 py-2.5 transition-colors hover:text-accent"
                      >
                        <Img
                          src={p.heroImage}
                          alt={p.name}
                          seed={p.id}
                          className="h-11 w-14 shrink-0 rounded-[var(--r-sm)]"
                          sizes="60px"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-ink">
                            {p.name}
                          </span>
                          <span className="block truncate text-[11px] text-faint">
                            {projectStatusLabel(p.status)} · from {formatPrice(p.priceMin)}
                          </span>
                        </span>
                        <ArrowUpRight size={13} className="shrink-0 text-faint" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="mt-5 flex gap-2">
              <Button
                variant="primary"
                size="md"
                className="flex-1"
                onClick={() => {
                  setUseBounds(false);
                  setFilters({ localitySlugs: [data.locality.slug] });
                  selectLocality(null);
                }}
              >
                Show {formatCount(data.stats.inventory)} homes
              </Button>
              <Link
                href={`/locality/${data.locality.slug}`}
                className="inline-flex h-10 items-center justify-center rounded-[var(--r-md)] border border-line px-4 text-[14px] font-medium text-ink transition-colors hover:bg-sunk"
              >
                Full profile
              </Link>
            </div>
          </div>
        </>
      )}
    </motion.aside>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-raised px-3 py-2.5">
      <div className="text-[11px] text-faint">{label}</div>
      <div className="tnum mt-0.5 flex items-center gap-1 text-[15px] font-semibold text-ink">
        {value}
        {icon}
      </div>
    </div>
  );
}

/** Five-year price trend. Small, quiet, and reads at a glance. */
function PriceTrend({ history }: { history: { year: number; priceSqft: number }[] }) {
  if (history.length < 2) return null;
  const w = 360;
  const h = 48;
  const values = history.map((p) => p.priceSqft);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = history.map((p, i) => {
    const x = (i / (history.length - 1)) * w;
    const y = h - ((p.priceSqft - min) / span) * (h - 6) - 3;
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${d} L${w},${h} L0,${h} Z`;

  return (
    <figure className="mt-4">
      <figcaption className="mb-1.5 flex items-baseline justify-between">
        <span className="eyebrow">Price per sq.ft</span>
        <span className="tnum text-[11px] text-faint">
          {history[0].year}–{history[history.length - 1].year}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full" role="img" aria-label="Price trend">
        <path d={area} fill="var(--accent-wash)" />
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill="var(--accent)" />
      </svg>
      <div className="tnum mt-1 flex justify-between text-[11px] text-faint">
        <span>{formatPriceSqft(history[0].priceSqft)}</span>
        <span>{formatPriceSqft(history[history.length - 1].priceSqft)}</span>
      </div>
    </figure>
  );
}

function NearbyRow({ place, onGo }: { place: NearbyPlace; onGo: () => void }) {
  return (
    <li>
      <button
        onClick={onGo}
        className="flex w-full items-baseline justify-between gap-3 text-left transition-colors hover:text-accent"
      >
        <span className="min-w-0 truncate text-[13px] text-ink">{place.name}</span>
        <span className="tnum shrink-0 text-[12px] text-faint">
          {place.distanceKm < 1
            ? `${Math.round(place.distanceKm * 1000)} m`
            : `${place.distanceKm} km`}
          {place.estimated && <span className="ml-1 text-[10px]">· ~{place.minutes} min est.</span>}
        </span>
      </button>
    </li>
  );
}

function NearbyGroups({
  places,
  onGo,
}: {
  places: NearbyPlace[];
  onGo: (p: NearbyPlace) => void;
}) {
  const groups = new Map<PoiCategory, NearbyPlace[]>();
  for (const p of places) {
    const arr = groups.get(p.category);
    if (arr) arr.push(p);
    else groups.set(p.category, [p]);
  }
  if (groups.size === 0) {
    return <p className="mt-2 text-[13px] text-faint">Nothing mapped nearby yet.</p>;
  }
  return (
    <div className="mt-2 space-y-3">
      {[...groups.entries()].map(([cat, items]) => (
        <div key={cat}>
          <div className="mb-1 text-[11px] font-medium text-faint">{POI_CATEGORY_LABEL[cat]}</div>
          <ul className="space-y-1">
            {items.slice(0, 3).map((p) => (
              <NearbyRow key={p.id} place={p} onGo={() => onGo(p)} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
