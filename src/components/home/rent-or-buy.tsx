"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ArrowUpRight, Info, SlidersHorizontal } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { QuietSelect } from "@/components/ui/quiet-select";
import { useIsMobile } from "@/lib/hooks/use-media-query";
import { useDiscovery } from "@/store/discovery";
import {
  DEFAULT_ASSUMPTIONS,
  appreciationNeededBy,
  projectRentVsBuy,
  type RentVsBuyInputs,
  type RentVsBuyResult,
} from "@/lib/finance/rent-vs-buy";
import { bhkLabel, formatPrice, formatRent } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Corridor {
  slug: string;
  name: string;
  corridor: string;
  center: { lat: number; lng: number };
  medianPrice: number;
  medianRent: number;
  medianMaintenance: number;
  medianAreaSqft: number;
  avgPriceSqft: number;
  momentumPct: number;
  grossYieldPct: number;
  buySample: number;
  rentSample: number;
  rentBasis: "locality" | "corridor" | "modelled";
  rentQuality: "verified" | "listed" | "estimated";
}

/** Rents are scarcer than prices, so the figure is taken at the narrowest level
 *  with a real sample. The row says which, rather than implying all three are
 *  the same kind of number. */
const RENT_BASIS_NOTE: Record<Corridor["rentBasis"], (c: Corridor) => string> = {
  locality: (c) => `${c.rentSample} local lets`,
  corridor: (c) => `${c.rentSample} lets, corridor rate`,
  modelled: () => "modelled yield",
};

/** Never let an unrecognised basis take the homepage down with it. */
function rentNote(c: Corridor): string {
  return (RENT_BASIS_NOTE[c.rentBasis] ?? (() => "rent estimate"))(c);
}

const BEDS = [2, 3, 4] as const;
const HORIZON = 20;

/**
 * Three ways of seeing the world, one click each.
 *
 * Four sliders was the right amount of control and the wrong amount of *work* —
 * nobody arrives at a homepage wanting to pick a loan rate. So the sliders moved
 * behind a disclosure and these carry the common cases: how dear the loan is,
 * and how well the money would have done elsewhere. That second one decides the
 * answer more than any other input and is the one nobody thinks to question.
 */
const OUTLOOKS = [
  {
    id: "cautious",
    label: "Cautious",
    blurb: "Dearer loan, strong markets",
    downPct: 20,
    ratePct: 9.5,
    investmentReturnPct: 11,
  },
  {
    id: "balanced",
    label: "Balanced",
    blurb: "Today's rates",
    downPct: 20,
    ratePct: 8.5,
    investmentReturnPct: 10,
  },
  {
    id: "bullish",
    label: "Bullish",
    blurb: "Cheap loan, flat markets",
    downPct: 30,
    ratePct: 8,
    investmentReturnPct: 8,
  },
] as const;

/**
 * Recent momentum, pulled back toward the city's long-run rate.
 *
 * Kollur has appreciated 16% a year. Carrying that forward for two decades
 * would have a ₹90 L flat worth ₹17 Cr and would make the answer worthless —
 * the crossover would simply track whichever corridor ran hottest last year.
 * So the corridor's own momentum is blended toward a 6% long-run city rate,
 * which keeps the ranking in the right order while keeping the magnitudes
 * defensible. The reader can overrule it with the slider, and the caption says
 * where the default came from.
 */
const LONG_RUN_PCT = 6;
function temperedAppreciation(momentumPct: number): number {
  return Math.round((LONG_RUN_PCT + (momentumPct - LONG_RUN_PCT) * 0.45) * 2) / 2;
}

/**
 * The question every buyer actually starts with.
 *
 * A listings portal answers "what can I buy" and leaves the prior question —
 * *should* I buy, here, now — to a spreadsheet the reader has to build
 * themselves. PropIT can answer it properly because it holds both sides of the
 * book: the same corridor's sale prices *and* its rents, for the same
 * configuration. That pairing is the whole feature; everything else here is
 * arithmetic over it.
 *
 * It replaced a coverflow carousel of featured homes, which showed the same
 * properties as the rail immediately below it. Two rails of the same cards is
 * one rail and a repetition.
 *
 * Nothing is asserted that cannot be shown: the medians carry their sample
 * sizes, a thin rental sample is labelled `estimated`, and every assumption
 * behind the curve is a control rather than a hidden constant.
 */
export function RentOrBuy() {
  const router = useRouter();
  const { setFilters, setUseBounds, selectLocality, flyTo } = useDiscovery();

  const [bedrooms, setBedrooms] = useState<number>(3);
  const [slug, setSlug] = useState<string | null>(null);
  const [outlookId, setOutlookId] = useState<string>("balanced");
  const [stayYears, setStayYears] = useState(7);
  const [tuning, setTuning] = useState(false);
  /** Each null until the reader overrules the preset, or the corridor's own
   *  tempered momentum. */
  const [downOverride, setDownOverride] = useState<number | null>(null);
  const [rateOverride, setRateOverride] = useState<number | null>(null);
  const [apprOverride, setApprOverride] = useState<number | null>(null);

  const outlook = OUTLOOKS.find((o) => o.id === outlookId) ?? OUTLOOKS[1];
  const downPct = downOverride ?? outlook.downPct;
  const ratePct = rateOverride ?? outlook.ratePct;

  const { data, isLoading } = useQuery<{ corridors: Corridor[] }>({
    queryKey: ["rent-vs-buy", bedrooms],
    placeholderData: keepPreviousData,
    staleTime: 10 * 60_000,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/insights/rent-vs-buy?bedrooms=${bedrooms}`, { signal });
      if (!res.ok) throw new Error("Couldn't load the rent and sale medians.");
      return res.json();
    },
  });

  const corridors = data?.corridors ?? [];
  const active = corridors.find((c) => c.slug === slug) ?? corridors[0] ?? null;
  const appreciationPct = apprOverride ?? (active ? temperedAppreciation(active.momentumPct) : LONG_RUN_PCT);

  const inputsFor = (c: Corridor): RentVsBuyInputs => ({
    ...DEFAULT_ASSUMPTIONS,
    price: c.medianPrice,
    rentMonthly: c.medianRent,
    maintenanceMonthly: c.medianMaintenance,
    investmentReturnPct: outlook.investmentReturnPct,
    downPct,
    ratePct,
    appreciationPct: apprOverride ?? temperedAppreciation(c.momentumPct),
    horizonYears: HORIZON,
  });

  const model: RentVsBuyResult | null = useMemo(
    () => (active ? projectRentVsBuy(inputsFor(active)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, downPct, ratePct, apprOverride, outlook.investmentReturnPct],
  );

  /** What the focused corridor would need, when as-modelled it never gets there. */
  const activeNeeds = useMemo(
    () =>
      active && model && !model.breakEvenYear
        ? appreciationNeededBy(inputsFor(active), HORIZON)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, model, downPct, ratePct, apprOverride, outlook.investmentReturnPct],
  );

  /**
   * Every corridor under the same assumptions, so the ranking is comparable.
   *
   * Corridors that pay back come first, soonest at the top; the rest follow by
   * how little growth they would need. Ranking on two metrics sounds muddled but
   * it is the only way the list stays ordered best-to-worst in both states —
   * on one metric alone, a pessimistic outlook collapses all forty into a tie.
   */
  const ranked = useMemo(
    () =>
      corridors
        .map((c) => {
          const inputs = inputsFor(c);
          const r = projectRentVsBuy(inputs);
          return {
            c,
            year: r.breakEvenYear,
            needs: r.breakEvenYear ? null : appreciationNeededBy(inputs, HORIZON),
          };
        })
        .sort((a, b) => {
          if (a.year && b.year) return a.year - b.year;
          if (a.year) return -1;
          if (b.year) return 1;
          return (a.needs ?? 99) - (b.needs ?? 99);
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [corridors, downPct, ratePct, apprOverride, outlook.investmentReturnPct],
  );

  const atStay = model?.points.find((p) => p.year === stayYears) ?? null;
  const anyPayback = ranked.some((r) => r.year);

  function openOnMap(c: Corridor) {
    setUseBounds(false);
    setFilters({ listingType: "buy", bedrooms: [bedrooms], localitySlugs: [c.slug] });
    selectLocality(c.slug);
    flyTo(c.center, 13);
    router.push("/search");
  }

  function pickOutlook(id: string) {
    setOutlookId(id);
    // A preset that left the reader's old slider values in place would not be a
    // preset. Overrules are cleared so the choice actually takes effect.
    setDownOverride(null);
    setRateOverride(null);
  }

  return (
    <section className="border-t border-line bg-sunk px-5 py-20 md:px-8 md:py-24">
      <div className="mx-auto max-w-[1440px]">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-[46ch]">
              <p className="eyebrow mb-3">Rent or buy · Hyderabad</p>
              <h2 className="display text-[34px] leading-[1.04] text-ink md:text-[46px]">
                How long until buying wins?
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted">
                Both sides start with the same money and spend the same amount each month. The year
                the two lines cross is the year owning is worth it.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1.5">
                {BEDS.map((b) => (
                  <button
                    key={b}
                    onClick={() => setBedrooms(b)}
                    aria-pressed={bedrooms === b}
                    className={cn(
                      "h-9 rounded-[var(--r-sm)] border px-3.5 text-[13px] transition-colors duration-[160ms]",
                      bedrooms === b
                        ? "border-[var(--accent)] bg-accent text-[var(--accent-ink)]"
                        : "border-line bg-raised text-ink hover:border-line-strong",
                    )}
                  >
                    {b === 4 ? "4 BHK+" : bhkLabel(b)}
                  </button>
                ))}
              </div>
              {corridors.length > 0 && (
                <QuietSelect
                  label="Corridor"
                  value={active?.slug ?? null}
                  align="right"
                  options={corridors.map((c) => ({ value: c.slug, label: c.name }))}
                  onChange={(v) => {
                    setSlug(v);
                    setApprOverride(null);
                  }}
                />
              )}
            </div>
          </div>
        </Reveal>

        {isLoading && !active && (
          <div className="mt-10 h-[420px] animate-pulse rounded-[var(--r-lg)] border border-line bg-raised" />
        )}

        {!isLoading && !active && (
          <p className="mt-10 text-[14px] text-muted">
            No corridor has enough {bhkLabel(bedrooms)} listings on both sides of the book to compare
            yet. Try another configuration.
          </p>
        )}

        {active && model && (
          <>
            <Reveal delay={0.05}>
              <div className="mt-10 grid gap-px overflow-hidden rounded-[var(--r-lg)] border border-line bg-[var(--line)] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                {/* The answer, in words, before any chart. */}
                <div className="flex flex-col bg-raised p-6 md:p-8">
                  <p className="eyebrow mb-4 text-faint">{active.name}</p>

                  {model.breakEvenYear ? (
                    <>
                      <p className="display text-[56px] leading-[0.95] text-ink md:text-[68px]">
                        Year {model.breakEvenYear}
                      </p>
                      <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-muted">
                        Stay longer than{" "}
                        <strong className="font-medium text-ink">{model.breakEvenYear} years</strong>{" "}
                        and buying a {bhkLabel(bedrooms)} here beats renting one. Leave sooner and
                        renting was the better trade.
                      </p>
                    </>
                  ) : activeNeeds != null ? (
                    <>
                      <p className="display text-[40px] leading-[1] text-ink md:text-[50px]">
                        Needs {activeNeeds}% a year
                      </p>
                      <p className="mt-4 max-w-[36ch] text-[15px] leading-relaxed text-muted">
                        At {appreciationPct}% growth, buying here never catches renting. Prices would
                        have to rise{" "}
                        <strong className="font-medium text-ink">{activeNeeds}% a year</strong> for
                        owning to be ahead within {HORIZON} years.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="display text-[40px] leading-[1] text-ink md:text-[50px]">
                        Renting wins
                      </p>
                      <p className="mt-4 max-w-[36ch] text-[15px] leading-relaxed text-muted">
                        At a {active.grossYieldPct.toFixed(1)}% yield the rent here is so low against
                        the price that no realistic growth makes buying the better trade.
                      </p>
                    </>
                  )}

                  <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-6">
                    <Figure
                      label="Median price"
                      value={formatPrice(active.medianPrice)}
                      note={`${active.buySample} listings`}
                    />
                    <Figure
                      label="Median rent"
                      value={formatRent(active.medianRent)}
                      note={rentNote(active)}
                      soft={active.rentBasis === "modelled"}
                    />
                    <Figure
                      label="EMI"
                      value={formatRent(model.emi)}
                      note={`${DEFAULT_ASSUMPTIONS.tenureYears} yrs at ${ratePct}%`}
                    />
                    <Figure
                      label="Upfront"
                      value={formatPrice(model.upfront)}
                      note={`${downPct}% deposit + ${DEFAULT_ASSUMPTIONS.closingPct}% duty`}
                    />
                  </dl>

                  <p className="mt-6 text-[13.5px] leading-relaxed text-faint">
                    Owning costs{" "}
                    <span className="tnum text-muted">{formatRent(model.monthlyOwning)}</span> here —{" "}
                    {(model.monthlyOwning / active.medianRent).toFixed(1)}× the rent, on a{" "}
                    {active.grossYieldPct.toFixed(1)}% gross yield.
                  </p>

                  <button
                    onClick={() => openOnMap(active)}
                    className="group mt-auto inline-flex items-center gap-1.5 pt-7 text-[15px] text-ink transition-colors hover:text-accent"
                  >
                    See {bhkLabel(bedrooms)} homes in {active.name}
                    <ArrowUpRight
                      size={14}
                      strokeWidth={2}
                      className="text-accent transition-transform duration-[180ms] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </button>
                </div>

                {/* The curves, with only the control that matters by default. */}
                <div className="bg-raised p-6 md:p-8">
                  <CrossoverChart model={model} stayYears={stayYears} />

                  <div className="mt-7 border-t border-line pt-6">
                    <Dial
                      label="How long will you stay?"
                      value={stayYears}
                      min={1}
                      max={HORIZON}
                      step={1}
                      onChange={setStayYears}
                      display={`${stayYears} ${stayYears === 1 ? "year" : "years"}`}
                    />
                    <p className="mt-3 text-[15px] leading-relaxed text-muted">
                      {atStay && atStay.advantage >= 0
                        ? "Owning is ahead by "
                        : "Renting is ahead by "}
                      <span
                        className={cn(
                          "tnum font-medium",
                          atStay && atStay.advantage >= 0
                            ? "text-accent"
                            : "text-[var(--data-clay)]",
                        )}
                      >
                        {formatPrice(Math.abs(atStay?.advantage ?? 0))}
                      </span>{" "}
                      if you leave in year {stayYears}.
                    </p>
                  </div>

                  <div className="mt-6 border-t border-line pt-5">
                    <button
                      onClick={() => setTuning((v) => !v)}
                      aria-expanded={tuning}
                      className="inline-flex flex-wrap items-center gap-x-2 text-[13.5px] text-muted transition-colors hover:text-ink"
                    >
                      <SlidersHorizontal size={13} strokeWidth={1.75} />
                      {tuning ? "Hide assumptions" : "Change the assumptions"}
                      <span className="text-faint">
                        · {outlook.label.toLowerCase()}, {appreciationPct}% growth
                      </span>
                    </button>

                    {tuning && (
                      <div className="mt-5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {OUTLOOKS.map((o) => (
                            <button
                              key={o.id}
                              onClick={() => pickOutlook(o.id)}
                              aria-pressed={o.id === outlookId}
                              className={cn(
                                "h-9 rounded-[var(--r-sm)] border px-3.5 text-[13px] transition-colors duration-[160ms]",
                                o.id === outlookId
                                  ? "border-[var(--accent-line)] bg-[var(--accent-wash)] font-medium text-accent"
                                  : "border-line bg-raised text-muted hover:border-line-strong hover:text-ink",
                              )}
                            >
                              {o.label}
                            </button>
                          ))}
                          <p className="ml-1 text-[12.5px] text-faint">
                            {outlook.blurb} · {outlook.investmentReturnPct}% if invested instead
                          </p>
                        </div>

                        <div className="mt-5 grid gap-5 sm:grid-cols-3">
                          <Dial
                            label="Deposit"
                            value={downPct}
                            min={10}
                            max={60}
                            step={5}
                            onChange={setDownOverride}
                            display={`${downPct}%`}
                          />
                          <Dial
                            label="Loan rate"
                            value={ratePct}
                            min={7}
                            max={12}
                            step={0.25}
                            onChange={setRateOverride}
                            display={`${ratePct}%`}
                          />
                          <Dial
                            label="Price growth"
                            value={appreciationPct}
                            min={0}
                            max={14}
                            step={0.5}
                            onChange={setApprOverride}
                            display={`${appreciationPct}%`}
                            note={
                              apprOverride != null
                                ? "your figure"
                                : Math.abs(active.momentumPct - appreciationPct) < 1
                                  ? `${active.name}'s own rate`
                                  : `${active.momentumPct}% lately, eased to ${LONG_RUN_PCT}%`
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Where in the city the deposit turns over fastest. */}
            <Reveal delay={0.1}>
              <div className="mt-12">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <h3 className="text-[19px] font-medium text-ink">
                    The same {bhkLabel(bedrooms)}, corridor by corridor
                  </h3>
                  <p className="text-[13px] text-faint">
                    {anyPayback
                      ? "Years until owning is ahead, on your assumptions"
                      : `Growth each corridor needs to pay off within ${HORIZON} years`}
                  </p>
                </div>

                <ul className="mt-5 grid gap-px overflow-hidden rounded-[var(--r-lg)] border border-line bg-[var(--line)] sm:grid-cols-2 xl:grid-cols-3">
                  {ranked.slice(0, 9).map(({ c, year, needs }) => (
                    <li key={c.slug}>
                      <button
                        onClick={() => {
                          setSlug(c.slug);
                          setApprOverride(null);
                        }}
                        aria-pressed={c.slug === active.slug}
                        className={cn(
                          "flex w-full items-center gap-4 px-5 py-4 text-left transition-colors duration-[160ms]",
                          c.slug === active.slug
                            ? "bg-[var(--accent-wash)]"
                            : "bg-raised hover:bg-sunk",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14.5px] font-medium text-ink">{c.name}</p>
                          <p className="tnum mt-1 truncate text-[12px] text-faint">
                            {formatPrice(c.medianPrice)} · {formatRent(c.medianRent)} ·{" "}
                            {c.grossYieldPct.toFixed(1)}% yield
                          </p>
                        </div>
                        <p className="tnum shrink-0 text-right">
                          {year ? (
                            <>
                              <span className="text-[24px] font-semibold text-ink">{year}</span>
                              <span className="ml-1 text-[12px] text-faint">yr</span>
                            </>
                          ) : needs != null ? (
                            <>
                              <span className="text-[24px] font-semibold text-muted">{needs}</span>
                              <span className="ml-1 text-[12px] text-faint">% needed</span>
                            </>
                          ) : (
                            <span className="text-[13px] text-faint">never</span>
                          )}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>

                <p className="mt-5 flex max-w-[92ch] items-start gap-2 text-[12.5px] leading-relaxed text-faint">
                  <Info size={13} strokeWidth={1.75} className="mt-[3px] shrink-0" />
                  <span>
                    Prices are the median of PropIT&apos;s own {bhkLabel(bedrooms)} sale listings
                    in each corridor. Rents are taken at the narrowest level with a real sample —
                    the locality, else its corridor&apos;s rent per sq.ft, else the locality&apos;s
                    modelled yield — and each tile says which it used. The rest is arithmetic on
                    your assumptions: a {DEFAULT_ASSUMPTIONS.tenureYears}-year loan,{" "}
                    {DEFAULT_ASSUMPTIONS.closingPct}% Telangana duty and registration,{" "}
                    {DEFAULT_ASSUMPTIONS.rentEscalationPct}% annual rent escalation,{" "}
                    {outlook.investmentReturnPct}% on the renter&apos;s invested capital
                    and {DEFAULT_ASSUMPTIONS.sellingCostPct}% to sell. It is a model, not advice,
                    and it ignores tax relief on interest — which shortens every payback above.
                  </span>
                </p>
              </div>
            </Reveal>
          </>
        )}
      </div>
    </section>
  );
}

function Figure({
  label,
  value,
  note,
  soft = false,
}: {
  label: string;
  value: string;
  note?: string;
  soft?: boolean;
}) {
  return (
    <div>
      <dt className="eyebrow text-[9px] text-faint">{label}</dt>
      <dd className={cn("tnum mt-1.5 text-[19px] font-semibold", soft ? "text-muted" : "text-ink")}>
        {value}
      </dd>
      {note && <dd className="mt-0.5 text-[11.5px] text-faint">{note}</dd>}
    </div>
  );
}

function Dial({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
  note,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
  note?: string;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-muted">{label}</span>
        <span className="tnum text-[13px] font-medium text-ink">{display}</span>
      </span>
      <input
        type="range"
        className="propit-range mt-1.5 w-full"
        style={{ ["--fill" as string]: `${fill}%` }}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {note && <span className="mt-0.5 block text-[11.5px] text-faint">{note}</span>}
    </label>
  );
}

/**
 * Two wealth curves and the year they cross.
 *
 * Drawn as one shape rather than two lines plus a legend: the band between the
 * curves is the whole argument, and it changes colour at the crossing — clay
 * while renting is ahead, green once owning is. That way the answer survives
 * being glanced at, which is how a chart on a homepage is actually read.
 *
 * The curves are named at their own ends rather than in a legend underneath. A
 * legend makes the reader hold two colours in their head and look twice; a word
 * at the end of a line is read in place. It also means the only figures on the
 * chart are the two that matter — what each choice is finally worth — where
 * before there were none at all, and the curves could not be valued.
 *
 * Except on a phone, where that inverts. SVG text is measured in user units, so
 * it shrinks with the viewBox: the same 11.5 that reads cleanly across 700px
 * lands near 5px across 285px, which is not a label, it is a smudge. So narrow
 * screens drop the in-chart naming and take the two figures as real HTML
 * underneath — crisp at any width, and it buys the curves back the 120px of
 * gutter the labels needed.
 */
function CrossoverChart({ model, stayYears }: { model: RentVsBuyResult; stayYears: number }) {
  const compact = useIsMobile();
  const W = compact ? 380 : 640;
  const H = compact ? 210 : 280;
  // Room at the right for the end labels, and at the top for the crossing note.
  // A phone has neither, because it labels the curves below the chart instead.
  const PAD = compact
    ? { top: 26, right: 12, bottom: 26, left: 6 }
    : { top: 32, right: 122, bottom: 28, left: 8 };
  const FONT = compact ? { tick: 13, note: 13, label: 0, value: 0 } : { tick: 10.5, note: 11, label: 11.5, value: 11 };
  const TICKS = compact ? [0, 10, 20] : [0, 5, 10, 15, 20];

  const pts = model.points;
  const maxY = Math.max(...pts.flatMap((p) => [p.buyWealth, p.rentWealth]));
  const minY = Math.min(0, ...pts.flatMap((p) => [p.buyWealth, p.rentWealth]));
  const lastYear = pts[pts.length - 1]?.year || 1;
  const last = pts[pts.length - 1];

  const x = (year: number) => PAD.left + (year / lastYear) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    H - PAD.bottom - ((v - minY) / (maxY - minY || 1)) * (H - PAD.top - PAD.bottom);

  const line = (key: "buyWealth" | "rentWealth") =>
    pts.map((p, i) => `${i ? "L" : "M"}${x(p.year).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(" ");

  // The band, split at the crossing so each half can carry its own colour.
  const cross = model.breakEvenExact;
  const band = (from: number, to: number) => {
    const inRange = pts.filter((p) => p.year >= from - 1 && p.year <= to + 1);
    if (inRange.length < 2) return "";
    const clamp = (p: (typeof pts)[number], key: "buyWealth" | "rentWealth") =>
      `${x(Math.min(Math.max(p.year, from), to)).toFixed(1)} ${y(p[key]).toFixed(1)}`;
    const top = inRange.map((p, i) => `${i ? "L" : "M"}${clamp(p, "buyWealth")}`).join(" ");
    const back = [...inRange].reverse().map((p) => `L${clamp(p, "rentWealth")}`).join(" ");
    return `${top} ${back} Z`;
  };

  const crossX = cross != null ? x(cross) : null;
  const stayPoint = pts.find((p) => p.year === stayYears);

  // Keep the two end labels off each other when the curves finish close
  // together — which is exactly when the answer is finely balanced and the
  // figures matter most.
  const buyEndY = y(last.buyWealth);
  const rentEndY = y(last.rentWealth);
  const crowded = Math.abs(buyEndY - rentEndY) < 36;
  const nudge = crowded ? (last.buyWealth >= last.rentWealth ? -11 : 11) : 0;

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[210px] w-full lg:h-[280px]"
        role="img"
        aria-label={
          model.breakEvenYear
            ? `Owning overtakes renting in year ${model.breakEvenYear}`
            : `Renting stays ahead for all ${lastYear} years`
        }
      >
        {/* Horizon gridlines, every five years. */}
        {TICKS.filter((t) => t > 0 && t <= lastYear).map((t) => (
          <line
            key={t}
            x1={x(t)}
            x2={x(t)}
            y1={PAD.top - 14}
            y2={H - PAD.bottom}
            stroke="var(--line)"
            strokeWidth="1"
          />
        ))}

        <path d={band(0, cross ?? lastYear)} fill="var(--data-clay)" opacity="0.13" />
        {cross != null && <path d={band(cross, lastYear)} fill="var(--accent)" opacity="0.14" />}

        <path
          d={line("rentWealth")}
          fill="none"
          stroke="var(--data-clay)"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d={line("buyWealth")}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.25"
          strokeLinejoin="round"
        />

        {crossX != null && (
          <>
            <line
              x1={crossX}
              x2={crossX}
              y1={PAD.top - 14}
              y2={H - PAD.bottom}
              stroke="var(--accent)"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.55"
            />
            <circle
              cx={crossX}
              cy={y(pts.find((p) => p.year === model.breakEvenYear)?.buyWealth ?? 0)}
              r="4"
              fill="var(--paper-raised)"
              stroke="var(--accent)"
              strokeWidth="2"
            />
            <text
              x={crossX}
              y={PAD.top - 20}
              textAnchor="middle"
              fill="var(--accent)"
              fontSize={FONT.note}
              fontWeight="600"
            >
              {compact ? `Yr ${model.breakEvenYear}` : `Buying wins · yr ${model.breakEvenYear}`}
            </text>
          </>
        )}

        {/* Where the reader says they'll leave. */}
        {stayPoint && (
          <>
            <line
              x1={x(stayYears)}
              x2={x(stayYears)}
              y1={PAD.top - 14}
              y2={H - PAD.bottom}
              stroke="var(--ink)"
              strokeWidth="1"
              opacity="0.3"
            />
            <circle cx={x(stayYears)} cy={y(stayPoint.buyWealth)} r="3.5" fill="var(--accent)" />
            <circle
              cx={x(stayYears)}
              cy={y(stayPoint.rentWealth)}
              r="3.5"
              fill="var(--data-clay)"
            />
          </>
        )}

        {TICKS.filter((t) => t <= lastYear).map((t) => (
          <text
            key={t}
            x={x(t)}
            y={H - 8}
            textAnchor={t === 0 ? "start" : "middle"}
            fill="var(--ink-faint)"
            fontSize={FONT.tick}
            className="tnum"
          >
            {t === 0 ? "Today" : `Yr ${t}`}
          </text>
        ))}
        {!compact && (
        <g>
          <text
            x={x(lastYear) + 10}
            y={buyEndY + nudge - 3}
            fill="var(--accent)"
            fontSize={FONT.label}
            fontWeight="600"
          >
            Buying
          </text>
          <text
            x={x(lastYear) + 10}
            y={buyEndY + nudge + 12}
            fill="var(--ink-faint)"
            fontSize={FONT.value}
            className="tnum"
          >
            {formatPrice(last.buyWealth)}
          </text>

          <text
            x={x(lastYear) + 10}
            y={rentEndY - nudge - 3}
            fill="var(--data-clay)"
            fontSize={FONT.label}
            fontWeight="600"
          >
            Renting
          </text>
          <text
            x={x(lastYear) + 10}
            y={rentEndY - nudge + 12}
            fill="var(--ink-faint)"
            fontSize={FONT.value}
            className="tnum"
          >
            {formatPrice(last.rentWealth)}
          </text>
        </g>
        )}
      </svg>

      {compact && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
          <EndValue color="var(--accent)" label="Buying" value={formatPrice(last.buyWealth)} />
          <EndValue
            color="var(--data-clay)"
            label="Renting"
            value={formatPrice(last.rentWealth)}
          />
        </div>
      )}

      <figcaption className="mt-2 text-[12px] leading-relaxed text-faint">
        What each choice is worth over time — the home&apos;s resale value less the loan, against the
        renter&apos;s invested savings.
      </figcaption>
    </figure>
  );
}

/** One curve's name and closing value, for widths where SVG text cannot hold up. */
function EndValue({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span
        className="translate-y-[-3px] h-[2px] w-4 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      <span className="text-[12.5px] font-medium" style={{ color }}>
        {label}
      </span>
      <span className="tnum text-[12.5px] text-muted">{value}</span>
    </span>
  );
}
