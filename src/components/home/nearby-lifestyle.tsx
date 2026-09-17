"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Dumbbell,
  GraduationCap,
  Plane,
  ShoppingBag,
  Stethoscope,
  TramFront,
  Trees,
  Trophy,
  UtensilsCrossed,
} from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { useDiscovery } from "@/store/discovery";
import { formatDistance } from "@/lib/format";
import type { PoiCategory } from "@/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof GraduationCap> = {
  school: GraduationCap,
  hospital: Stethoscope,
  metro: TramFront,
  office_hub: Building2,
  mall: ShoppingBag,
  park: Trees,
  stadium: Trophy,
  restaurant: UtensilsCrossed,
  gym: Dumbbell,
  airport: Plane,
};

export interface CorridorReach {
  slug: string;
  name: string;
  blurb: string;
  center: { lat: number; lng: number };
  /** Straight-line distance, in km, from this corridor to each category's nearest place. */
  nearest: { category: PoiCategory; label: string; name: string; km: number }[];
}

/**
 * What a home is near, measured rather than asserted.
 *
 * Every figure here is straight-line distance computed from the same POI data
 * the map draws — no travel times, because PropIT has no routing provider
 * connected and a minutes figure would be a guess wearing a number's clothes.
 * When routing is configured these become real durations and the wording
 * changes with them.
 *
 * Connectivity and "what's nearby" are the same question asked twice, so they
 * are one section: pick a corridor, see what it reaches.
 */
export function NearbyLifestyle({ corridors }: { corridors: CorridorReach[] }) {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const { setFilters, setUseBounds, selectLocality, flyTo, toggleLayer, layers } = useDiscovery();

  const current = corridors[active];
  if (!current) return null;

  function showCategory(cat: PoiCategory) {
    if (!layers[cat]) toggleLayer(cat);
    setUseBounds(false);
    selectLocality(current.slug);
    flyTo(current.center, 13.4);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <section className="border-t border-line bg-sunk px-5 py-20 md:px-8 md:py-24">
      <div className="mx-auto max-w-[1440px]">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-[40ch]">
              <p className="eyebrow mb-3">Live closer to what matters</p>
              <h2 className="display text-[32px] leading-[1.05] text-ink md:text-[42px]">
                A home is more than its address.
              </h2>
            </div>
            <p className="max-w-[38ch] text-[14px] leading-relaxed text-muted">
              Distances are measured in a straight line from each corridor&apos;s centre. They are
              not drive times — PropIT will say minutes only once it can measure them.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <ul className="mt-10 flex flex-wrap gap-2 border-b border-line pb-6">
            {corridors.map((c, i) => (
              <li key={c.slug}>
                <button
                  onClick={() => setActive(i)}
                  aria-pressed={i === active}
                  className={cn(
                    "rounded-full border px-4 py-2 text-[14px] transition-colors duration-[160ms]",
                    i === active
                      ? "border-[var(--accent)] bg-accent text-[var(--accent-ink)]"
                      : "border-line bg-raised text-muted hover:border-line-strong hover:text-ink",
                  )}
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
            <div>
              <h3 className="display text-[28px] leading-tight text-ink md:text-[34px]">
                {current.name}
              </h3>
              <p className="mt-3 max-w-[38ch] text-[15px] leading-relaxed text-muted">
                {current.blurb}
              </p>
              <button
                onClick={() => {
                  setUseBounds(false);
                  setFilters({ localitySlugs: [current.slug] });
                  selectLocality(current.slug);
                  flyTo(current.center, 13.2);
                  router.push("/search");
                }}
                className="mt-6 text-[15px] text-accent underline decoration-[var(--accent-line)] underline-offset-4 transition-colors hover:text-ink"
              >
                Open {current.name} on the map
              </button>
            </div>

            {/* Distance, then what the distance is to. The number leads because
                it is the thing being compared. */}
            {/*
              `minmax(0,1fr)` rather than a bare `grid-cols-2`.

              A grid track defaults to `min-width: auto`, so it refuses to go
              narrower than its content — and the place name below carried a
              `max-w-[22ch]`, about 143px at this size. Two of those plus the
              32px gutter needed 318px inside a 280px column, so at 320px the
              whole homepage panned sideways. Flooring the tracks at zero lets
              the name truncate as it was always meant to, and the gutter
              tightens on the narrowest screens.
            */}
            <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-5 gap-y-7 sm:grid-cols-[repeat(3,minmax(0,1fr))] sm:gap-x-8">
              {current.nearest.map((n) => {
                const Icon = ICONS[n.category] ?? Building2;
                return (
                  <div key={n.category} className="min-w-0">
                    <dt className="flex items-center gap-2">
                      <Icon size={14} strokeWidth={1.75} className="text-[var(--data-brass)]" />
                      <span className="eyebrow">{n.label}</span>
                    </dt>
                    <dd className="mt-2">
                      <button
                        onClick={() => showCategory(n.category)}
                        className="group block w-full min-w-0 text-left"
                      >
                        <span className="tnum block text-[24px] font-medium leading-none text-ink transition-colors group-hover:text-accent">
                          {formatDistance(n.km)}
                        </span>
                        <span className="mt-1.5 block max-w-full truncate text-[13px] text-muted sm:max-w-[22ch]">
                          {n.name}
                        </span>
                      </button>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
