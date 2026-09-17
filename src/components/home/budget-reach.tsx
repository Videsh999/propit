"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { useDiscovery } from "@/store/discovery";
import type { LocalityCount } from "@/lib/hooks/use-properties";
import { formatArea, formatCount, formatPrice, formatPriceSqft } from "@/lib/format";
import { cn } from "@/lib/utils";

const BUDGETS = [
  { label: "₹50 L", value: 5000000 },
  { label: "₹80 L", value: 8000000 },
  { label: "₹1 Cr", value: 10000000 },
  { label: "₹1.5 Cr", value: 15000000 },
  { label: "₹2 Cr", value: 20000000 },
  { label: "₹3 Cr", value: 30000000 },
  { label: "₹5 Cr", value: 50000000 },
] as const;

/**
 * Where a budget actually reaches.
 *
 * This replaced a projects carousel, which was the page's third horizontal card
 * rail in a row and said nothing a buyer could act on. The question it answers
 * instead is the first one anyone asks about Hyderabad and the one no portal
 * answers directly: not "show me homes under ₹1.5 Cr" — a list does that — but
 * *where that money goes furthest, and what it buys once you get there.*
 *
 * Every figure is real: counts come from the same query the map runs, and the
 * area is that budget divided by the corridor's own ₹/sq.ft. That division is
 * arithmetic on modelled prices, not a quote, and the section says so.
 */
export function BudgetReach() {
  const router = useRouter();
  const { setFilters, setUseBounds, selectLocality, flyTo } = useDiscovery();
  const [budget, setBudget] = useState<number>(15000000);

  const { data, isLoading } = useQuery<{ total: number; localityCounts: LocalityCount[] }>({
    queryKey: ["budget-reach", budget],
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `/api/properties?type=buy&maxPrice=${budget}&limit=1&sort=relevance`,
        { signal },
      );
      if (!res.ok) throw new Error("Couldn't work out what that budget reaches.");
      return res.json();
    },
  });

  // Most inventory first: where the budget has the most to choose from.
  const rows = (data?.localityCounts ?? []).slice(0, 6);
  const label = BUDGETS.find((b) => b.value === budget)?.label ?? formatPrice(budget);

  function open(row: LocalityCount) {
    setUseBounds(false);
    setFilters({ priceMin: null, priceMax: budget, localitySlugs: [row.slug] });
    selectLocality(row.slug);
    flyTo({ lat: row.lat, lng: row.lng }, 13);
    router.push("/search");
  }

  return (
    <section className="border-t border-line px-5 py-20 md:px-8 md:py-24">
      <div className="mx-auto max-w-[1440px]">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-[42ch]">
              <p className="eyebrow mb-3">Budget · Hyderabad</p>
              <h2 className="display text-[34px] leading-[1.04] text-ink md:text-[46px]">
                What your budget actually buys.
              </h2>
            </div>
            <p className="max-w-[36ch] text-[14px] leading-relaxed text-muted">
              Area is your budget divided by the corridor&apos;s ₹/sq.ft — arithmetic on modelled
              prices, not a quote. Counts are live.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="mt-9 flex flex-wrap items-center gap-2">
            <span className="eyebrow mr-1">I can spend</span>
            {BUDGETS.map((b) => (
              <button
                key={b.value}
                onClick={() => setBudget(b.value)}
                aria-pressed={budget === b.value}
                className={cn(
                  "tnum h-9 rounded-[var(--r-sm)] border px-3.5 text-[14px] transition-colors duration-[160ms]",
                  budget === b.value
                    ? "border-[var(--accent)] bg-accent text-[var(--accent-ink)]"
                    : "border-line bg-raised text-ink hover:border-line-strong",
                )}
              >
                {b.label}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <p className="mt-6 text-[16px] text-muted">
            {isLoading && !data ? (
              <span className="text-faint">Working it out…</span>
            ) : (
              <>
                <span className="tnum font-semibold text-ink">
                  {formatCount(data?.total ?? 0)}
                </span>{" "}
                homes under {label}, across{" "}
                <span className="tnum font-medium text-ink">
                  {data?.localityCounts.length ?? 0}
                </span>{" "}
                localities. These six have the most.
              </>
            )}
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          {/*
            Columns drop in reverse order of importance.

            With a min-width and a horizontal scroller, the phone showed
            Corridor / Homes / ₹ per sq.ft and pushed "buys about" — the one
            number this section exists for — off the right edge. Now the area
            never leaves, and the supporting figures appear as there is room.
          */}
          <div className="mt-8">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <th className="eyebrow py-2.5 font-medium">Corridor</th>
                  <th className="eyebrow hidden py-2.5 text-right font-medium sm:table-cell">
                    Homes
                  </th>
                  <th className="eyebrow hidden py-2.5 text-right font-medium sm:table-cell">
                    ₹ / sq.ft
                  </th>
                  <th className="eyebrow py-2.5 text-right font-medium">{label} buys</th>
                  <th className="eyebrow hidden py-2.5 text-right font-medium md:table-cell">
                    1 yr
                  </th>
                  <th className="sr-only">Open</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const buysSqft = Math.round(budget / row.avgPriceSqft);
                  return (
                    <tr
                      key={row.slug}
                      onMouseEnter={() => flyTo({ lat: row.lat, lng: row.lng }, 12.4)}
                      className="group border-b border-line transition-colors duration-[160ms] hover:bg-sunk"
                    >
                      <td className="py-4 pr-4">
                        <button onClick={() => open(row)} className="text-left">
                          <span className="display block text-[21px] leading-tight text-ink transition-colors group-hover:text-accent md:text-[24px]">
                            {row.name}
                          </span>
                          <span className="tnum mt-0.5 block text-[12px] text-faint">
                            from {formatPrice(row.minPrice)}
                            <span className="sm:hidden">
                              {" · "}
                              {row.count} homes · {formatPriceSqft(row.avgPriceSqft)}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="tnum hidden py-4 text-right text-[15px] text-ink sm:table-cell">
                        {row.count}
                      </td>
                      <td className="tnum hidden py-4 text-right text-[15px] text-muted sm:table-cell">
                        {formatPriceSqft(row.avgPriceSqft)}
                      </td>
                      {/* The number this section exists for. */}
                      <td className="tnum py-4 text-right text-[16px] font-medium text-ink">
                        {formatArea(buysSqft)}
                      </td>
                      <td className="tnum hidden py-4 text-right text-[15px] md:table-cell">
                        <span
                          className={
                            row.momentumPct >= 0 ? "text-accent" : "text-[var(--data-clay)]"
                          }
                        >
                          <TrendingUp
                            size={11}
                            strokeWidth={2}
                            className="mr-1 inline-block align-[-1px]"
                            aria-hidden
                          />
                          {row.momentumPct >= 0 ? "+" : ""}
                          {row.momentumPct}%
                        </span>
                      </td>
                      <td className="hidden py-4 pl-4 text-right md:table-cell">
                        <button
                          onClick={() => open(row)}
                          aria-label={`Open ${row.name} on the map under ${label}`}
                          className="inline-flex items-center gap-1 text-[13px] text-muted opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          Open
                          <ArrowUpRight size={13} strokeWidth={2} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-[14px] text-muted">
                      Nothing on the market under {label} right now. Try the next step up.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
