"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import { Img } from "@/components/ui/img";
import { Reveal } from "@/components/ui/reveal";
import { useDiscovery } from "@/store/discovery";
import { formatCount, formatPrice, formatPriceSqft } from "@/lib/format";
import type { Locality } from "@/types";
import { cn } from "@/lib/utils";

/**
 * The locality index.
 *
 * Two registers rather than one grid of forty identical cards. The three
 * localities carrying the most inventory get written up — an image, a sentence
 * about what living there is actually like, and the numbers that decide it. The
 * rest arrive as a corridor-by-corridor table, which is denser, directly
 * comparable, and reads like a market report instead of an advertisement.
 *
 * Every row is a handle on the map: hovering places it, clicking opens it there.
 */
export function LocalityIndex({ localities }: { localities: Locality[] }) {
  const byInventory = [...localities].sort((a, b) => b.inventoryCount - a.inventoryCount);
  const leads = byInventory.slice(0, 3);
  const leadSlugs = new Set(leads.map((l) => l.slug));

  const corridors = new Map<string, Locality[]>();
  for (const l of localities) {
    const key = l.corridor.split("·")[0].trim();
    const arr = corridors.get(key);
    if (arr) arr.push(l);
    else corridors.set(key, [l]);
  }
  for (const list of corridors.values()) list.sort((a, b) => b.avgPriceSqft - a.avgPriceSqft);

  return (
    <>
      <section className="space-y-20 md:space-y-28">
        {leads.map((l, i) => (
          <LeadLocality key={l.id} locality={l} flip={i % 2 === 1} index={i} />
        ))}
      </section>

      <section className="mt-24 md:mt-32">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-5">
            <h2 className="display text-[28px] leading-tight text-ink md:text-[36px]">
              Every corridor, measured the same way.
            </h2>
            <p className="max-w-[42ch] text-[13px] leading-relaxed text-muted">
              Prices are modelled from listed inventory, not transaction records. Hover a row to
              place it on the map.
            </p>
          </div>
        </Reveal>

        {[...corridors.entries()].map(([corridor, items]) => (
          <div key={corridor} className="mt-12 first:mt-8">
            <h3 className="eyebrow mb-1">{corridor} Hyderabad</h3>
            <CorridorTable localities={items} highlighted={leadSlugs} />
          </div>
        ))}
      </section>
    </>
  );
}

function LeadLocality({
  locality: l,
  flip,
  index,
}: {
  locality: Locality;
  flip: boolean;
  index: number;
}) {
  return (
    <Reveal delay={index * 0.04}>
      <article className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
        <Link
          href={`/locality/${l.slug}`}
          className={cn("group block overflow-hidden rounded-[var(--r-lg)]", flip && "lg:order-2")}
        >
          <Img
            src={l.heroImage}
            alt={l.name}
            seed={l.slug}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="aspect-[5/4] w-full transition-transform duration-[700ms] [transition-timing-function:var(--ease)] group-hover:scale-[1.02]"
          />
        </Link>

        <div className={cn(flip && "lg:order-1")}>
          <p className="eyebrow mb-3">{l.corridor}</p>
          <h2 className="display text-[36px] leading-[1.04] text-ink md:text-[48px]">
            <Link href={`/locality/${l.slug}`} className="transition-colors hover:text-accent">
              {l.name}
            </Link>
          </h2>
          <p className="mt-4 max-w-[46ch] text-[16px] leading-relaxed text-muted">{l.summary}</p>

          <dl className="mt-8 grid max-w-[30rem] grid-cols-2 gap-x-8 gap-y-5 border-t border-line pt-6 sm:grid-cols-4">
            <Stat label="₹ / sq.ft" value={formatPriceSqft(l.avgPriceSqft)} />
            <Stat label="Median" value={formatPrice(l.medianPrice)} />
            <Stat label="Homes" value={formatCount(l.inventoryCount)} />
            <Stat
              label="1 yr"
              value={`+${l.momentumPct}%`}
              tone={l.momentumPct > 0 ? "up" : undefined}
            />
          </dl>

          <Link
            href={`/locality/${l.slug}`}
            className="group mt-7 inline-flex items-center gap-1.5 text-[15px] text-ink transition-colors hover:text-accent"
          >
            Read the locality report
            <ArrowUpRight
              size={15}
              strokeWidth={2}
              className="text-accent transition-transform duration-[180ms] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </Link>
        </div>
      </article>
    </Reveal>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" }) {
  return (
    <div>
      <dt className="eyebrow mb-1">{label}</dt>
      <dd
        className={cn(
          "tnum text-[17px] font-medium",
          tone === "up" ? "text-accent" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function CorridorTable({
  localities,
  highlighted,
}: {
  localities: Locality[];
  highlighted: Set<string>;
}) {
  const router = useRouter();
  const { setFilters, setUseBounds, selectLocality, flyTo } = useDiscovery();

  function open(l: Locality) {
    setUseBounds(false);
    setFilters({ localitySlugs: [l.slug] });
    selectLocality(l.slug);
    flyTo(l.center, 13);
    router.push("/search");
  }

  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-line">
          <th className="eyebrow py-2.5 font-medium">Locality</th>
          <th className="eyebrow py-2.5 text-right font-medium">₹ / sq.ft</th>
          <th className="eyebrow hidden py-2.5 text-right font-medium sm:table-cell">1 yr</th>
          <th className="eyebrow py-2.5 text-right font-medium">Homes</th>
          <th className="eyebrow hidden py-2.5 text-right font-medium md:table-cell">Projects</th>
        </tr>
      </thead>
      <tbody>
        {localities.map((l) => (
          <tr
            key={l.id}
            onMouseEnter={() => flyTo(l.center, 12.4)}
            className="group border-b border-line transition-colors duration-[160ms] hover:bg-sunk"
          >
            <td className="py-4 pr-4">
              <button onClick={() => open(l)} className="block max-w-[46ch] text-left">
                <span className="display flex items-center gap-2 text-[20px] leading-tight text-ink transition-colors group-hover:text-accent md:text-[24px]">
                  {l.name}
                  {highlighted.has(l.slug) && (
                    <span className="eyebrow rounded-full border border-[var(--accent-line)] px-2 py-0.5 text-[9px] text-accent">
                      Featured
                    </span>
                  )}
                </span>
                <span className="mt-1 block truncate text-[13px] text-muted">{l.character}</span>
              </button>
            </td>
            <td className="tnum py-4 text-right text-[15px] text-ink">
              {formatPriceSqft(l.avgPriceSqft)}
            </td>
            <td className="tnum hidden py-4 text-right text-[15px] sm:table-cell">
              <span className={l.momentumPct >= 0 ? "text-accent" : "text-[var(--data-clay)]"}>
                <TrendingUp
                  size={11}
                  strokeWidth={2}
                  className="mr-1 inline-block align-[-1px]"
                  aria-hidden
                />
                {l.momentumPct >= 0 ? "+" : ""}
                {l.momentumPct}%
              </span>
            </td>
            <td className="tnum py-4 text-right text-[15px] text-muted">
              {formatCount(l.inventoryCount)}
            </td>
            <td className="tnum hidden py-4 text-right text-[15px] text-muted md:table-cell">
              {l.projectCount}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
