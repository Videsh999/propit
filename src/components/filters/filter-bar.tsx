"use client";

import { AnimatePresence, motion } from "motion/react";
import { SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { useDiscovery } from "@/store/discovery";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { activeFilterCount } from "@/lib/data/filters";
import { AMENITIES } from "@/lib/data/developers";
import { formatPrice, possessionLabel, propertyTypeLabel, bhkLabel } from "@/lib/format";
import type { PossessionStatus, PropertyType } from "@/types";

const TYPES: PropertyType[] = [
  "apartment",
  "villa",
  "independent_house",
  "penthouse",
  "plot",
  "farmhouse",
  "commercial",
];
const POSSESSIONS: PossessionStatus[] = [
  "ready",
  "within_6_months",
  "within_1_year",
  "under_construction",
];
const BHK = [0, 1, 2, 3, 4, 5];
/**
 * What the inline row shows, as opposed to the panel.
 *
 * The row lives in a 388px column. Every chip put in it is a chip the reader
 * has to scroll past to reach the next one, so the inline set is the bedroom
 * counts people actually filter by — Studio and the property types stay in the
 * panel, where there is room to lay them out flat.
 */
const BHK_INLINE = [1, 2, 3, 4, 5];

const BUY_STOPS = [0, 5e6, 1e7, 1.5e7, 2e7, 3e7, 4e7, 6e7, 1e8];
const RENT_STOPS = [0, 15000, 25000, 40000, 60000, 100000, 200000, 500000];

export function FilterBar({ hideInline = false }: { hideInline?: boolean } = {}) {
  const { filters, setFilters, toggleArrayFilter, resetFilters, filtersOpen, setFiltersOpen } =
    useDiscovery();
  const count = activeFilterCount(filters);
  const stops = filters.listingType === "rent" ? RENT_STOPS : BUY_STOPS;

  return (
    <>
      {/*
        Pinned ends, scrolling middle.

        This row was one flat `overflow-x-auto` flex holding twelve controls:
        909px of chips inside a 388px column, so 521px of them sat off the
        right-hand edge — past the viewport, under the map. Worse, the Filters
        button used `ml-auto`, which in an overflowing flex container pushes it
        to the end of the *content* rather than the end of the *box*: the one
        control that opens everything else was the one furthest out of reach.

        So the two controls that matter now sit on their own line — the listing
        toggle left, Filters hard right — and the bedroom counts take the line
        below, where the full column width fits all five of them with nothing
        clipped. Two tidy lines beat one scrolling line in a column this narrow:
        the reader can see every option without discovering that the row moves.

        The chip strip keeps `overflow-x-auto` and its fade as a floor, for
        widths narrower than any breakpoint here anticipates.
      */}
      {!hideInline && <div className="flex flex-wrap items-center gap-2">
        <div className="flex shrink-0 items-center rounded-full border border-line bg-raised p-0.5">
          {(["buy", "rent"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilters({ listingType: t, priceMin: null, priceMax: null })}
              className={`rounded-full px-3 py-1 text-[13px] font-medium capitalize transition-colors ${
                filters.listingType === t
                  ? "bg-inverse text-[var(--ink-inverse)]"
                  : "text-muted hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <button
          onClick={() => setFiltersOpen(true)}
          className={`ml-auto inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors sm:h-8 sm:px-3 ${
            count > 0
              ? "border-[var(--accent-line)] bg-[var(--accent-wash)] text-accent"
              : "border-line bg-raised text-muted hover:text-ink"
          }`}
        >
          <SlidersHorizontal size={13} strokeWidth={1.75} />
          Filters
          {count > 0 && <span className="tnum">({count})</span>}
        </button>

        <div className="relative order-last min-w-0 basis-full">
          <div className="scroll-quiet flex items-center gap-1.5 overflow-x-auto pr-6">
            {BHK_INLINE.map((b) => (
              <Chip
                key={b}
                active={filters.bedrooms.includes(b)}
                onClick={() => toggleArrayFilter("bedrooms", b)}
                className="shrink-0"
              >
                {b === 5 ? "5+" : bhkLabel(b)}
              </Chip>
            ))}
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[var(--paper)] to-transparent"
          />
        </div>

      </div>}

      <AnimatePresence>
        {filtersOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFiltersOpen(false)}
              className="fixed inset-0 z-[60] bg-[rgba(0,0,0,0.28)] backdrop-blur-[2px]"
            />
            <motion.div
              role="dialog"
              aria-label="Advanced filters"
              initial={{ x: 32, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 32, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="scroll-quiet fixed right-0 top-0 z-[61] flex h-full w-full max-w-[440px] flex-col overflow-y-auto border-l border-line bg-paper"
            >
              <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-paper px-6 py-4">
                <h2 className="display text-[24px] text-ink">Refine</h2>
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-[var(--r-sm)] text-faint hover:bg-sunk hover:text-ink sm:h-8 sm:w-8"
                  aria-label="Close filters"
                >
                  <X size={16} strokeWidth={1.75} />
                </button>
              </header>

              <div className="space-y-7 px-6 py-6">
                <Section title="Property type">
                  <div className="flex flex-wrap gap-1.5">
                    {TYPES.map((t) => (
                      <Chip
                        key={t}
                        active={filters.propertyTypes.includes(t)}
                        onClick={() => toggleArrayFilter("propertyTypes", t)}
                      >
                        {propertyTypeLabel(t)}
                      </Chip>
                    ))}
                  </div>
                </Section>

                <Section title="Bedrooms">
                  <div className="flex flex-wrap gap-1.5">
                    {BHK.map((b) => (
                      <Chip
                        key={b}
                        active={filters.bedrooms.includes(b)}
                        onClick={() => toggleArrayFilter("bedrooms", b)}
                      >
                        {b === 5 ? "5+ BHK" : bhkLabel(b)}
                      </Chip>
                    ))}
                  </div>
                </Section>

                <Section
                  title="Budget"
                  aside={
                    filters.priceMin != null || filters.priceMax != null ? (
                      <span className="tnum text-[12px] text-muted">
                        {filters.priceMin != null ? formatPrice(filters.priceMin) : "Any"} –{" "}
                        {filters.priceMax != null ? formatPrice(filters.priceMax) : "Any"}
                      </span>
                    ) : null
                  }
                >
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      label="Minimum"
                      value={filters.priceMin}
                      options={stops}
                      onChange={(v) => setFilters({ priceMin: v })}
                    />
                    <Select
                      label="Maximum"
                      value={filters.priceMax}
                      options={stops}
                      onChange={(v) => setFilters({ priceMax: v })}
                    />
                  </div>
                </Section>

                <Section title="Built-up area (sq.ft)">
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField
                      label="Minimum"
                      value={filters.areaMin}
                      onChange={(v) => setFilters({ areaMin: v })}
                    />
                    <NumberField
                      label="Maximum"
                      value={filters.areaMax}
                      onChange={(v) => setFilters({ areaMax: v })}
                    />
                  </div>
                </Section>

                <Section title="Possession">
                  <div className="flex flex-wrap gap-1.5">
                    {POSSESSIONS.map((p) => (
                      <Chip
                        key={p}
                        active={filters.possession.includes(p)}
                        onClick={() => toggleArrayFilter("possession", p)}
                      >
                        {possessionLabel(p)}
                      </Chip>
                    ))}
                  </div>
                </Section>

                <Section title="Amenities">
                  <div className="flex flex-wrap gap-1.5">
                    {AMENITIES.map((a) => (
                      <Chip
                        key={a.slug}
                        active={filters.amenities.includes(a.slug)}
                        onClick={() => toggleArrayFilter("amenities", a.slug)}
                      >
                        {a.name}
                      </Chip>
                    ))}
                  </div>
                </Section>

                <Section title="Trust">
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={filters.verifiedOnly}
                      onChange={(e) => setFilters({ verifiedOnly: e.target.checked })}
                      className="h-4 w-4 rounded-[3px] accent-[var(--accent)]"
                    />
                    <span className="text-[14px] text-ink">Verified listings only</span>
                  </label>
                </Section>
              </div>

              <footer className="sticky bottom-0 mt-auto flex items-center gap-2 border-t border-line bg-paper px-6 py-4">
                <Button variant="ghost" size="md" onClick={resetFilters} className="gap-1.5">
                  <RotateCcw size={14} strokeWidth={1.75} />
                  Reset
                </Button>
                <Button variant="primary" size="md" className="flex-1" onClick={() => setFiltersOpen(false)}>
                  Show results
                </Button>
              </footer>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between">
        <h3 className="eyebrow">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number | null;
  options: number[];
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-faint">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="h-10 w-full rounded-[var(--r-sm)] border border-line bg-raised px-2.5 text-[14px] text-ink outline-none focus:border-[var(--accent-line)]"
      >
        <option value="">Any</option>
        {options.filter((o) => o > 0).map((o) => (
          <option key={o} value={o}>
            {formatPrice(o)}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-faint">{label}</span>
      <input
        type="number"
        min={0}
        step={50}
        value={value ?? ""}
        placeholder="Any"
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="tnum h-10 w-full rounded-[var(--r-sm)] border border-line bg-raised px-2.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-[var(--accent-line)]"
      />
    </label>
  );
}
