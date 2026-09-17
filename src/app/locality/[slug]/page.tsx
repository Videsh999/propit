import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { localityIntelligence, getDeveloper, propertiesInLocality } from "@/lib/data/repository";
import { Img } from "@/components/ui/img";
import { QualityBadge } from "@/components/ui/badge";
import { ProjectCard } from "@/components/cards/project-card";
import { POI_CATEGORY_LABEL } from "@/lib/data/pois";
import { formatCount, formatPrice, formatPriceSqft, formatRent } from "@/lib/format";
import type { NearbyPlace, PoiCategory } from "@/types";
import { LocalityCta } from "@/components/locality/locality-cta";
import { LocalityMap } from "@/components/locality/locality-map";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = localityIntelligence(slug);
  if (!data) return { title: "Locality not found" };
  const title = `${data.locality.name} property guide`;
  const description = `${data.locality.name}, Hyderabad — ${formatPriceSqft(
    data.stats.avgPriceSqft,
  )} average, ${data.stats.inventory} homes across ${data.stats.projects} projects. ${
    data.locality.character
  }.`;
  return {
    title,
    description,
    openGraph: { title, description, images: [data.locality.heroImage] },
    alternates: { canonical: `/locality/${slug}` },
  };
}

export default async function LocalityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = localityIntelligence(slug);
  if (!data) notFound();

  const { locality, stats, nearby, connectivity, topProjects, featured } = data;

  // Every listing in the locality goes on its map — a map showing six of them
  // would misrepresent the place.
  const mapPoints = propertiesInLocality(locality.id).map((p) => ({
    id: p.id,
    location: p.location,
    price: p.price,
    bedrooms: p.bedrooms,
    propertyType: p.propertyType,
  }));
  const groups = new Map<PoiCategory, NearbyPlace[]>();
  for (const p of nearby) {
    const arr = groups.get(p.category);
    if (arr) arr.push(p);
    else groups.set(p.category, [p]);
  }

  return (
    <main className="pb-24">
      <section className="relative">
        <Img
          src={locality.heroImage}
          alt={locality.name}
          seed={locality.slug}
          className="h-[46vh] max-h-[480px] min-h-[300px] w-full"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.8)] via-[rgba(0,0,0,0.15)] to-transparent" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-[1440px] px-5 pb-8 md:px-8">
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/70">
              {locality.corridor}
            </p>
            <h1 className="display mt-1 text-[48px] leading-none text-white md:text-[68px]">
              {locality.name}
            </h1>
            <p className="mt-3 max-w-[52ch] text-[16px] leading-relaxed text-white/85">
              {locality.character}.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-5 md:px-8">
        <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-md)] border border-line bg-[var(--line)] md:grid-cols-6">
          <Stat label="Average" value={formatPriceSqft(stats.avgPriceSqft)} />
          <Stat label="Median home" value={formatPrice(stats.medianPrice)} />
          <Stat label="Homes" value={formatCount(stats.inventory)} />
          <Stat label="Projects" value={formatCount(stats.projects)} />
          <Stat label="Rental yield" value={`${stats.rentalYieldPct}%`} />
          <Stat
            label="Year on year"
            value={`+${stats.momentumPct}%`}
            icon={<TrendingUp size={12} strokeWidth={2} className="text-[var(--accent)]" />}
          />
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <QualityBadge quality="estimated" label="PropIT estimate" />
          <span className="text-[12px] text-faint">
            Modelled from listed inventory in {locality.name}, not audited transaction data.
          </span>
        </div>

        <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <h2 className="display text-[28px] text-ink">The character of {locality.name}</h2>
            <p className="mt-4 max-w-[68ch] text-[16px] leading-relaxed text-muted">
              {locality.summary}
            </p>
            {stats.avgRent > 0 && (
              <p className="mt-4 max-w-[68ch] text-[15px] leading-relaxed text-muted">
                Rentals here average{" "}
                <span className="tnum font-medium text-ink">{formatRent(stats.avgRent)}</span>, which
                against local sale prices implies a yield of about{" "}
                <span className="tnum font-medium text-ink">{stats.rentalYieldPct}%</span>.
              </p>
            )}

            <LocalityMap locality={locality} properties={mapPoints} />

            <h2 className="display mt-14 text-[28px] text-ink">Price per sq.ft, five years</h2>
            <PriceChart history={data.priceHistory} />

            <h2 className="display mt-12 text-[28px] text-ink">What&apos;s nearby</h2>
            <div className="mt-5 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...groups.entries()].map(([cat, items]) => (
                <div key={cat}>
                  <h3 className="mb-2 text-[13px] font-medium text-ink">
                    {POI_CATEGORY_LABEL[cat]}
                  </h3>
                  <ul className="space-y-1.5">
                    {items.slice(0, 3).map((p) => (
                      <li key={p.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="min-w-0 truncate text-muted">{p.name.split(",")[0]}</span>
                        <span className="tnum shrink-0 text-faint">
                          {p.distanceKm < 1
                            ? `${Math.round(p.distanceKm * 1000)} m`
                            : `${p.distanceKm} km`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {topProjects.length > 0 && (
              <>
                <h2 className="display mt-14 text-[28px] text-ink">Projects in {locality.name}</h2>
                <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-x-5 gap-y-9 sm:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(3,minmax(0,1fr))]">
                  {topProjects.map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      developerName={getDeveloper(p.developerId)?.name ?? "Developer"}
                      localityName={locality.name}
                    />
                  ))}
                </div>
              </>
            )}

            {featured.length > 0 && (
              <>
                <h2 className="display mt-14 text-[28px] text-ink">Homes for sale here</h2>
                {/*
                  Every track floored at zero, not left on `auto`.

                  The cards carry a `truncate` title, and `truncate` sets
                  `white-space: nowrap` — so the title's *min-content* width is
                  the whole untruncated string. An `auto` track will not shrink
                  below that, so a single column computed to 330px inside a
                  280px container and pushed the page sideways at 320px. With
                  `minmax(0,1fr)` the track can shrink and the ellipsis does the
                  job it was added for.
                */}
                <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-x-5 gap-y-8 sm:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(3,minmax(0,1fr))]">
                  {featured.map((p) => (
                    <Link key={p.id} href={`/property/${p.slug}`} className="group block">
                      <Img
                        src={p.images[0]?.url ?? ""}
                        alt={p.title}
                        seed={p.id}
                        className="aspect-[16/11] w-full rounded-[var(--r-md)]"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                      <h3 className="mt-3 truncate text-[15px] font-medium text-ink transition-colors group-hover:text-accent">
                        {p.title}
                      </h3>
                      <p className="tnum mt-1 text-[15px] font-semibold text-ink">
                        {formatPrice(p.price)}
                        <span className="ml-2 text-[12px] font-normal text-faint">
                          {formatPriceSqft(p.pricePerSqft)}
                        </span>
                      </p>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>

          <aside className="lg:sticky lg:top-[92px] lg:h-fit">
            <div className="rounded-[var(--r-lg)] border border-line bg-raised p-5">
              <h3 className="text-[14px] font-medium text-ink">Connectivity</h3>
              <ul className="mt-3 space-y-2">
                {connectivity.slice(0, 6).map((c) => (
                  <li key={c.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate text-muted">{c.name}</span>
                    <span className="tnum shrink-0 text-faint">{c.distanceKm} km</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] leading-relaxed text-faint">
                Straight-line distances. Driving times depend on the route and time of day.
              </p>
              <LocalityCta slug={locality.slug} name={locality.name} count={stats.inventory} />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-paper px-4 py-4">
      <div className="text-[11px] text-faint">{label}</div>
      <div className="tnum mt-1 flex items-center gap-1 text-[19px] font-semibold text-ink">
        {value}
        {icon}
      </div>
    </div>
  );
}

function PriceChart({ history }: { history: { year: number; priceSqft: number }[] }) {
  const w = 720;
  const h = 180;
  const pad = 8;
  const values = history.map((p) => p.priceSqft);
  const min = Math.min(...values) * 0.94;
  const max = Math.max(...values) * 1.03;
  const span = max - min || 1;
  const pts = history.map((p, i) => {
    const x = pad + (i / (history.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p.priceSqft - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    <figure className="mt-5 overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full min-w-[420px]" role="img" aria-label="Price per square foot over five years">
        <path d={`${d} L${w - pad},${h - pad} L${pad},${h - pad} Z`} fill="var(--accent-wash)" />
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="3" fill="var(--paper)" stroke="var(--accent)" strokeWidth="1.5" />
            <text x={x} y={h - 1} textAnchor="middle" className="fill-[var(--ink-faint)]" style={{ fontSize: 10 }}>
              {history[i].year}
            </text>
            <text x={x} y={y - 9} textAnchor="middle" className="fill-[var(--ink-muted)]" style={{ fontSize: 10, fontVariantNumeric: "tabular-nums" }}>
              {(history[i].priceSqft / 1000).toFixed(1)}k
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-2 text-[11px] text-faint">
        PropIT estimate, modelled from listed inventory. Not an index of recorded transactions.
      </figcaption>
    </figure>
  );
}
