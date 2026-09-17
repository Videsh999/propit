"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, SlidersHorizontal } from "lucide-react";
import { PropitMap } from "@/components/map/propit-map";
import { MapToolbar } from "@/components/map/map-toolbar";
import { MapStatusBar } from "@/components/map/map-status-bar";
import { PropertyPreview } from "@/components/property/property-preview";
import { useSelectedProperty } from "@/lib/hooks/use-selected-property";
import { SearchInput } from "@/components/search/search-input";
import { LifePlaces } from "@/components/life/life-places";
import { useProperties } from "@/lib/hooks/use-properties";
import { usePoiViewport } from "@/lib/hooks/use-poi-viewport";
import { useDiscovery } from "@/store/discovery";
import { AnimatePresence } from "motion/react";
import { formatCount } from "@/lib/format";
import type { Locality } from "@/types";
import { cn } from "@/lib/utils";

type LocalityLite = Pick<
  Locality,
  "slug" | "name" | "center" | "boundary" | "avgPriceSqft" | "inventoryCount"
>;

/**
 * The hero's height, shared by the map and the controls beside it.
 *
 * Declared once because the two must match exactly: the panel scrolls inside
 * this height, and if it and the map disagree the column either overflows the
 * map again or leaves a gap under it.
 */
const HERO_H =
  "h-[62svh] min-h-[420px] lg:h-[calc(100svh-72px-56px)] lg:min-h-[620px] lg:max-h-[940px]";

const BEDROOMS = [
  { value: 1, short: "1" },
  { value: 2, short: "2" },
  { value: 3, short: "3" },
  { value: 4, short: "4" },
  { value: 5, short: "5+" },
];

const BUDGETS = [
  { value: "any", short: "Any", min: null, max: null },
  { value: "u1", short: "Under ₹1 Cr", min: null, max: 10000000 },
  { value: "1-2", short: "₹1–2 Cr", min: 10000000, max: 20000000 },
  { value: "2-4", short: "₹2–4 Cr", min: 20000000, max: 40000000 },
  { value: "4+", short: "₹4 Cr+", min: 40000000, max: null },
] as const;

/**
 * The hero.
 *
 * Left: the sentence and the controls — what you tell PropIT.
 * Right: the map — what PropIT tells you.
 *
 * That order matters. Reading left to right, the page states a problem and then
 * answers it, and every control on the left has a visible consequence on the
 * right without a page change. The map takes the larger share because it is the
 * product, not an illustration of it.
 */
export function Hero({ localities }: { localities: LocalityLite[] }) {
  const router = useRouter();
  const { filters, setFilters, toggleArrayFilter, setUseBounds, setFiltersOpen } = useDiscovery();
  const { data, isLoading } = useProperties({ limit: 1 });
  const previewProperty = useDiscovery((s) => s.previewProperty);
  // A marker click on the map only yields an id; this turns it into a preview.
  useSelectedProperty();

  const total = data?.total ?? 0;

  return (
    <section className="px-5 pb-12 pt-5 md:px-8 md:pb-16">
      <div className="mx-auto grid max-w-[1440px] gap-6 lg:grid-cols-[minmax(0,40fr)_minmax(0,60fr)] lg:gap-10">
        {/*
          On a phone this is one column in three beats: the promise and the
          search, then the map answering, then the controls that refine it. So
          the statement is read before the instrument, and the instrument before
          the dials. `display: contents` dissolves this wrapper on small screens
          so its two halves become grid items the map can sit between; from lg
          it becomes the left column again and the order props stop applying.
        */}
        <div className={cn("contents lg:flex lg:flex-col", HERO_H)}>
        <div className="order-1 shrink-0">
          <p className="fade-rise eyebrow mb-4" style={{ ["--delay" as string]: 60 }}>
            Hyderabad · Secunderabad · ORR
          </p>
          <h1 className="display text-[46px] leading-[0.98] text-ink md:text-[58px] xl:text-[66px]">
            <span className="line-mask">
              <span style={{ ["--line" as string]: 0 }}>Find where</span>
            </span>
            <span className="line-mask">
              <span style={{ ["--line" as string]: 1 }}>your life fits.</span>
            </span>
          </h1>
          <p
            className="fade-rise mt-5 max-w-[36ch] text-[16px] leading-relaxed text-muted"
            style={{ ["--delay" as string]: 380 }}
          >
            Name the places your days already revolve around. PropIT draws the ground between them
            and shows you the homes inside it.
          </p>

          {/*
            `relative z-40` is load-bearing, not decoration.

            The suggestion list is `absolute … z-50`, which only ranks it
            *within its own stacking context* — and `.fade-rise` animates opacity
            and transform, so every wrapper carrying it becomes one. With no
            z-index of its own this wrapper sat at `auto` alongside the anchors
            column below, and in a tie the later sibling wins: the list painted
            *underneath* "My office" and "My family", interleaving locality
            prices with the anchor rows. Raising the wrapper lifts the whole
            context, list included.
          */}
          <div
            className="fade-rise relative z-40 mt-8"
            style={{ ["--delay" as string]: 480 }}
          >
            <SearchInput placeholder="3 BHK under ₹2 Cr near Financial District" />
          </div>
        </div>


        {/*
          The controls, in their own scroll.

          At 1440 these stood 979px tall against a 772px map, so the column ran
          past the bottom of the map and the primary action fell below the fold —
          the user had to scroll the whole page away from the map to act on it.
          Now the panel is exactly as tall as the map, this middle section takes
          the overflow, and the CTA is pinned beneath it where it is always
          reachable. On a phone there is no second column to match, so it all
          returns to normal document flow.
        */}
        <div className="scroll-quiet order-3 flex flex-col lg:fade-out-b lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-10 lg:pr-3">
          <div className="fade-rise mt-2 lg:mt-0" style={{ ["--delay" as string]: 580 }}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-medium text-ink">Where does your life happen?</h2>
              <span className="eyebrow">Optional</span>
            </div>
            <div className="mt-3">
              <LifePlaces />
            </div>
          </div>

          <div className="mt-8 border-t border-line pt-6">
            {/* Underlined tabs — lighter than a pill group, and they read as
                sections of one search rather than three separate products. */}
            <div className="flex items-center gap-6 border-b border-line">
              {(["buy", "rent"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilters({ listingType: t, priceMin: null, priceMax: null })}
                  className={cn(
                    "-mb-px border-b-2 pb-2.5 text-[15px] font-medium capitalize transition-colors duration-[160ms]",
                    filters.listingType === t
                      ? "border-[var(--accent)] text-ink"
                      : "border-transparent text-muted hover:text-ink",
                  )}
                >
                  {t}
                </button>
              ))}
              <Link
                href="/projects"
                className="-mb-px border-b-2 border-transparent pb-2.5 text-[15px] font-medium text-muted transition-colors hover:text-ink"
              >
                Projects
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              <span className="eyebrow w-[62px] shrink-0">Beds</span>
              <div className="flex flex-wrap gap-1.5">
                {BEDROOMS.map((b) => (
                  <button
                    key={b.value}
                    onClick={() => toggleArrayFilter("bedrooms", b.value)}
                    aria-pressed={filters.bedrooms.includes(b.value)}
                    aria-label={`${b.short} bedroom`}
                    className={cn(
                      "h-9 min-w-[44px] rounded-[var(--r-sm)] border px-3 text-[14px] transition-colors duration-[160ms]",
                      filters.bedrooms.includes(b.value)
                        ? "border-[var(--accent)] bg-accent text-[var(--accent-ink)]"
                        : "border-line bg-raised text-ink hover:border-line-strong",
                    )}
                  >
                    {b.short}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
              <span className="eyebrow w-[62px] shrink-0">Budget</span>
              <div className="flex flex-wrap gap-1.5">
                {BUDGETS.map((b) => {
                  const on = filters.priceMin === b.min && filters.priceMax === b.max;
                  return (
                    <button
                      key={b.value}
                      onClick={() => setFilters({ priceMin: b.min, priceMax: b.max })}
                      aria-pressed={on}
                      className={cn(
                        "h-9 rounded-[var(--r-sm)] border px-3.5 text-[14px] transition-colors duration-[160ms]",
                        on
                          ? "border-[var(--accent)] bg-accent text-[var(--accent-ink)]"
                          : "border-line bg-raised text-ink hover:border-line-strong",
                      )}
                    >
                      {b.short}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => setFiltersOpen(true)}
              className="mt-4 inline-flex h-8 items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
            >
              <SlidersHorizontal size={13} strokeWidth={1.75} />
              More filters
            </button>
          </div>
        </div>

        {/* Pinned: the primary action never scrolls out of reach. */}
        <div className="order-4 shrink-0 lg:pt-5">
          <button
            onClick={() => {
              setUseBounds(false);
              router.push("/search");
            }}
            className="group mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--r-pill)] bg-accent px-6 text-[15px] font-medium text-[var(--accent-ink)] transition-colors duration-[160ms] hover:bg-accent-hover"
          >
            {isLoading ? "Show homes" : `Show ${formatCount(total)} homes`}
            <ArrowRight
              size={16}
              strokeWidth={2}
              className="transition-transform duration-[180ms] group-hover:translate-x-0.5"
            />
          </button>
        </div>
        </div>
        {/* Show it. */}
        <div className={cn(
            "map-enter relative order-2 overflow-hidden rounded-[var(--r-canvas)] border border-line shadow-[var(--e2)]",
            HERO_H,
          )}>
          <HeroMap localities={localities} />
          <MapToolbar localities={localities} />
          <MapStatusBar
            total={total}
            isLoading={isLoading}
            localities={localities}
            expandHref="/search"
          />
          <AnimatePresence>{previewProperty && <PropertyPreview />}</AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function HeroMap({ localities }: { localities: LocalityLite[] }) {
  const { data } = useProperties({ limit: 1 });
  const setBounds = useDiscovery((s) => s.setBounds);
  const { data: poi } = usePoiViewport();

  return (
    <PropitMap
      compact
      points={data?.points ?? []}
      contextPoints={data?.contextPoints ?? []}
      localityCounts={data?.localityCounts ?? []}
      localities={localities}
      pois={poi.places}
      onBoundsChange={setBounds}
    />
  );
}
