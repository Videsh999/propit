"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { Img } from "@/components/ui/img";
import { Reveal } from "@/components/ui/reveal";
import { useDiscovery } from "@/store/discovery";
import { formatCount, formatPrice, formatPriceSqft } from "@/lib/format";
import type { Locality } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Localities as destinations, not rows.
 *
 * The homepage used to carry the full forty-row price table. It is a good table
 * — it still opens `/localities` — but on the homepage it turned the product
 * into a data portal at exactly the moment it should feel like somewhere you
 * might live. Here a handful of corridors get a photograph, a sentence about
 * what living there is actually like, and the three numbers that decide it.
 *
 * Picking one does not open another page: it scopes the search, flies the map
 * and hands the user back to the map they were already looking at.
 */
export function LocalityDiscovery({
  localities,
  totalCount,
}: {
  localities: Locality[];
  /** How many exist in all — the section shows five of them. */
  totalCount?: number;
}) {
  const router = useRouter();
  const { setFilters, setUseBounds, selectLocality, flyTo } = useDiscovery();
  const [active, setActive] = useState(0);

  const picks = localities.slice(0, 5);
  const current = picks[active];
  if (!current) return null;

  function explore(l: Locality) {
    setUseBounds(false);
    setFilters({ localitySlugs: [l.slug] });
    selectLocality(l.slug);
    flyTo(l.center, 13);
    router.push("/search");
  }

  return (
    <section className="border-t border-line px-5 py-20 md:px-8 md:py-24">
      <div className="mx-auto max-w-[1440px]">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-[40ch]">
              <p className="eyebrow mb-3">Explore Hyderabad</p>
              <h2 className="display text-[34px] leading-[1.04] text-ink md:text-[46px]">
                Know the places before you choose the home.
              </h2>
            </div>
            <Link
              href="/localities"
              className="group inline-flex items-center gap-1.5 text-[15px] text-ink transition-colors hover:text-accent"
            >
              All {totalCount ?? localities.length} localities
              <ArrowUpRight
                size={15}
                strokeWidth={2}
                className="text-accent transition-transform duration-[180ms] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-14">
            {/* The place itself */}
            <div className="relative overflow-hidden rounded-[var(--r-lg)] border border-line">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.slug}
                  initial={{ opacity: 0, scale: 1.015 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Img
                    src={current.heroImage}
                    alt={current.name}
                    seed={current.slug}
                    sizes="(max-width: 1024px) 100vw, 55vw"
                    className="aspect-[16/11] w-full"
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* What it is, and what it costs */}
            <div className="flex flex-col justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.slug}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className="eyebrow mb-2">{current.corridor}</p>
                  <h3 className="display text-[32px] leading-[1.05] text-ink md:text-[40px]">
                    {current.name}
                  </h3>
                  <p className="mt-4 max-w-[44ch] text-[16px] leading-relaxed text-muted">
                    {current.summary}
                  </p>

                  <PriceTrend history={current.priceHistory} />

                  {/*
                    Five figures, not three. The column used to stop after
                    ₹/sq.ft, homes and momentum, leaving most of its height
                    blank beside a very tall photograph — while the locality
                    record already carried a median, a project count, a yield
                    and six years of price history that nothing rendered.
                  */}
                  <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-6 sm:grid-cols-3">
                    <Stat label="₹ / sq.ft" value={formatPriceSqft(current.avgPriceSqft)} />
                    <Stat label="Median home" value={formatPrice(current.medianPrice)} />
                    <Stat
                      label="1 yr"
                      value={`${current.momentumPct >= 0 ? "+" : ""}${current.momentumPct}%`}
                      tone={current.momentumPct > 0 ? "up" : undefined}
                    />
                    <Stat label="Homes listed" value={formatCount(current.inventoryCount)} />
                    <Stat label="Projects" value={formatCount(current.projectCount)} />
                    <Stat label="Rental yield" value={`${current.rentalYieldPct}%`} />
                  </dl>

                  <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                    <button
                      onClick={() => explore(current)}
                      className="group inline-flex h-11 items-center gap-2 rounded-[var(--r-pill)] bg-accent px-5 text-[15px] font-medium text-[var(--accent-ink)] transition-colors duration-[160ms] hover:bg-accent-hover"
                    >
                      Explore on the map
                      <ArrowUpRight
                        size={15}
                        strokeWidth={2}
                        className="transition-transform duration-[180ms] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      />
                    </button>
                    <Link
                      href={`/locality/${current.slug}`}
                      className="text-[15px] text-muted underline decoration-[var(--line-strong)] underline-offset-4 transition-colors hover:text-ink"
                    >
                      Locality report
                    </Link>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </Reveal>

        {/* The other corridors, as a quiet index rather than five more cards. */}
        <Reveal delay={0.1}>
          <ul className="mt-12 flex flex-wrap gap-x-2 gap-y-2 border-t border-line pt-6">
            {picks.map((l, i) => (
              <li key={l.slug}>
                <button
                  onClick={() => setActive(i)}
                  onMouseEnter={() => setActive(i)}
                  aria-pressed={i === active}
                  className={cn(
                    "rounded-full border px-4 py-2 text-[14px] transition-colors duration-[160ms]",
                    i === active
                      ? "border-[var(--accent)] bg-accent text-[var(--accent-ink)]"
                      : "border-line bg-raised text-muted hover:border-line-strong hover:text-ink",
                  )}
                >
                  {l.name}
                  <span className="tnum ml-2 text-[12px] opacity-65">{l.inventoryCount}</span>
                </button>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * Six years of ₹/sq.ft, as a line.
 *
 * A single momentum percentage says a corridor moved; it does not say whether
 * that was steady or a spike, which is the part a buyer is actually reading for.
 * Drawn from the locality's own price history — the same series the locality
 * report uses — and labelled as modelled, because it is.
 */
function PriceTrend({ history }: { history: { year: number; priceSqft: number }[] }) {
  if (history.length < 2) return null;

  const W = 320;
  const H = 56;
  const values = history.map((h) => h.priceSqft);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;

  const pt = (i: number, v: number) => [
    (i / (history.length - 1)) * W,
    // Inset so the stroke and the end dot never clip at the edges.
    H - 5 - ((v - lo) / span) * (H - 10),
  ];
  const d = history.map((h, i) => `${i === 0 ? "M" : "L"}${pt(i, h.priceSqft).join(" ")}`).join("");
  const [lastX, lastY] = pt(history.length - 1, values[values.length - 1]);
  const first = history[0];
  const last = history[history.length - 1];

  return (
    <figure className="mt-8">
      <figcaption className="mb-2 flex items-baseline justify-between gap-3">
        <span className="eyebrow">₹ / sq.ft since {first.year}</span>
        <span className="tnum text-[12px] text-faint">
          {formatPriceSqft(first.priceSqft)} → {formatPriceSqft(last.priceSqft)}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[56px] w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Price per square foot rose from ${first.priceSqft} in ${first.year} to ${last.priceSqft} in ${last.year}`}
      >
        <path
          d={d}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={lastX} cy={lastY} r={3.5} fill="var(--accent)" />
      </svg>
      <p className="mt-1 flex justify-between text-[11px] text-faint">
        <span className="tnum">{first.year}</span>
        <span>Modelled from listed inventory</span>
        <span className="tnum">{last.year}</span>
      </p>
    </figure>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" }) {
  return (
    <div>
      <dt className="eyebrow mb-1">{label}</dt>
      <dd
        className={cn(
          "tnum whitespace-nowrap text-[17px] font-medium",
          tone === "up" ? "text-accent" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
