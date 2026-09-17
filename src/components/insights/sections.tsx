"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { Img } from "@/components/ui/img";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeader } from "@/components/ui/section-header";
import { useDiscovery } from "@/store/discovery";
import { formatCount, formatPrice, formatPriceSqft } from "@/lib/format";
import type { Developer, Locality, Property } from "@/types";

/**
 * Sections that belong to /insights.
 *
 * These used to live in the homepage module and were rendered only by the
 * insights page — a homepage file exporting three sections the homepage never
 * showed. They are the same components, moved to the page that actually uses
 * them, so the homepage module now contains only what the homepage renders.
 */

export interface InsightsProperty extends Property {
  localityName: string;
}

export interface InsightsDeveloper extends Developer {
  projectCount: number;
}

function Band({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`px-5 py-20 md:px-8 md:py-28 ${className}`}>
      <div className="mx-auto max-w-[1440px]">{children}</div>
    </section>
  );
}

export function FeaturedProperties({ properties }: { properties: InsightsProperty[] }) {
  return (
    <Band className="border-y border-line bg-sunk">
      <Reveal>
        <SectionHeader
          eyebrow="Featured homes"
          title="Verified, and priced in the open."
          href="/search"
          hrefLabel="Open the map"
        />
      </Reveal>
      <div className="grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
        {properties.map((p, i) => (
          <Reveal key={p.id} delay={Math.min(i, 4) * 0.05}>
            <Link href={`/property/${p.slug}`} className="group block">
              <Img
                src={p.images[0]?.url ?? ""}
                alt={p.title}
                seed={p.id}
                className="aspect-[4/3] w-full rounded-[var(--r-md)] transition-transform duration-[700ms] [transition-timing-function:var(--ease)] group-hover:scale-[1.02]"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
              <h3 className="mt-3 truncate text-[15px] font-medium text-ink transition-colors group-hover:text-accent">
                {p.title}
              </h3>
              <p className="truncate text-[12px] text-faint">{p.localityName}</p>
              <p className="tnum mt-1.5 text-[16px] font-semibold text-ink">
                {formatPrice(p.price)}
                <span className="ml-2 text-[12px] font-normal text-faint">
                  {formatPriceSqft(p.pricePerSqft)}
                </span>
              </p>
            </Link>
          </Reveal>
        ))}
      </div>
    </Band>
  );
}

export function Movers({ localities }: { localities: Locality[] }) {
  const router = useRouter();
  const { setFilters, setUseBounds, flyTo } = useDiscovery();

  return (
    <Band>
      <Reveal>
        <SectionHeader
          eyebrow="Locality intelligence"
          title="Where prices moved most this year."
          lead="Modelled from listed inventory — estimates, not recorded transaction indices. We'd rather say so than dress them up."
          href="/localities"
          hrefLabel="See the data"
        />
      </Reveal>
      <ul className="divide-y divide-[var(--line)] border-y border-line">
        {localities.map((l, i) => (
          <Reveal key={l.id} delay={Math.min(i, 5) * 0.04} y={10}>
            <li>
              <button
                onClick={() => {
                  setUseBounds(false);
                  setFilters({ localitySlugs: [l.slug] });
                  flyTo(l.center, 13);
                  router.push("/search");
                }}
                className="group flex w-full items-center gap-4 py-4 text-left"
              >
                <span className="tnum w-7 shrink-0 text-[13px] text-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-medium text-ink transition-colors group-hover:text-accent">
                    {l.name}
                  </span>
                  <span className="block truncate text-[13px] text-muted">{l.character}</span>
                </span>
                <span className="tnum hidden shrink-0 text-right text-[13px] text-muted sm:block">
                  {formatPriceSqft(l.avgPriceSqft)}
                  <span className="block text-[11px] text-faint">
                    {formatCount(l.inventoryCount)} homes
                  </span>
                </span>
                <span className="tnum inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--accent-line)] bg-[var(--accent-wash)] px-2.5 py-1 text-[13px] font-medium text-accent">
                  <TrendingUp size={12} strokeWidth={2} />+{l.momentumPct}%
                </span>
              </button>
            </li>
          </Reveal>
        ))}
      </ul>
    </Band>
  );
}


export function Developers({ developers }: { developers: InsightsDeveloper[] }) {
  return (
    <Band>
      <Reveal>
        <SectionHeader eyebrow="Developers" title="Who's building what." />
      </Reveal>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {developers.map((d, i) => (
          <Reveal key={d.id} delay={i * 0.05}>
            <div className="h-full rounded-[var(--r-md)] border border-line bg-raised p-5">
              <span className="grid h-11 w-11 place-items-center rounded-[var(--r-sm)] bg-inverse text-[14px] font-semibold text-[var(--ink-inverse)]">
                {d.logoMark}
              </span>
              <h3 className="mt-3.5 text-[15px] font-medium text-ink">{d.name}</h3>
              <p className="tnum mt-0.5 text-[12px] text-faint">
                Since {d.establishedYear} · {d.projectsDelivered} delivered
              </p>
              <p className="mt-2.5 line-clamp-3 text-[13px] leading-relaxed text-muted">{d.about}</p>
              <p className="tnum mt-3 text-[12px] text-accent">{d.projectCount} live on PropIT</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Band>
  );
}

