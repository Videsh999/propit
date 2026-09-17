"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Briefcase, GraduationCap, Sparkles, TramFront, TreePine } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeader } from "@/components/ui/section-header";
import { LocalityDiscovery } from "@/components/home/locality-discovery";
import { RentOrBuy } from "@/components/home/rent-or-buy";
import { PropertyRail } from "@/components/home/property-rail";
import { NearbyLifestyle, type CorridorReach } from "@/components/home/nearby-lifestyle";
import { Shortlist } from "@/components/home/shortlist";
import { ScheduleVisit } from "@/components/home/schedule-visit";
import { BudgetReach } from "@/components/home/budget-reach";
import { TopoBackdrop } from "@/components/ui/topo-backdrop";
import { useDiscovery } from "@/store/discovery";
import { formatCount } from "@/lib/format";
import type { Locality, PropertyType } from "@/types";

export interface HomeData {
  /** A handful of corridors, written up rather than tabulated. */
  featuredLocalities: Locality[];
  localityCount: number;
  corridors: CorridorReach[];
  /** One real architectural image for the viewing section. */
  visitImage: string;
  totals: { properties: number; projects: number; localities: number };
}

/**
 * Life-based entry points.
 *
 * Each one sets the map up for real — a resolved anchor, a real radius, a real
 * query — rather than dropping the user into a pre-filtered list.
 */
const LIFESTYLES: {
  icon: typeof Briefcase;
  title: string;
  copy: string;
  anchor?: { label: string; kind: "office" | "school"; place: string; km: number };
  filters?: { propertyTypes?: PropertyType[]; priceMax?: number };
  layer?: string;
}[] = [
  {
    icon: Briefcase,
    title: "Live near your office",
    copy: "Drop your workplace and see only what sits inside a commute you'd accept.",
    anchor: { label: "Office", kind: "office", place: "Financial District", km: 6 },
  },
  {
    icon: GraduationCap,
    title: "Great schools nearby",
    copy: "Anchor to a school and keep the morning run short.",
    anchor: { label: "School", kind: "school", place: "Oakridge International School", km: 4 },
  },
  {
    icon: TramFront,
    title: "Metro-connected",
    copy: "Homes along the Blue and Red lines, every station drawn on the map.",
    layer: "metro",
  },
  {
    icon: TreePine,
    title: "Quiet and green",
    copy: "Low-density living near the lakes on the city's western edge.",
    filters: { propertyTypes: ["villa", "independent_house", "farmhouse"] },
    layer: "park",
  },
];

/**
 * The page below the hero, as one continuous search rather than a stack of
 * sections.
 *
 * The order is the order a buyer actually thinks in: here are homes → should I
 * even be buying → where are they → what does my money actually reach → come
 * and see one → what is around them → ask it a question → shortlist → go.
 *
 * `RentOrBuy` sits second because it is the question that precedes every other
 * one on this page, and because it is the beat that stops the top of the page
 * being two card rails in a row. A coverflow carousel of featured homes used to
 * sit above the rail showing the same properties the rail showed; two rails of
 * the same cards is one rail and a repetition. The carousel was the section
 * that went, because the rail does real work — its filters are the map's, so
 * narrowing here narrows the hero too.
 *
 * A featured-projects carousel used to sit where the budget section now is. It
 * was the page's third horizontal card rail in a row, and it asked the reader
 * to admire inventory rather than telling them anything they could act on.
 * Projects still have `/projects` and a place in the nav; what the homepage
 * needed there was an answer, not another gallery.
 *
 * The viewing form follows, because that is the point in the page where someone
 * has seen something specific enough to want to stand in it — and it comes
 * before the concierge, so the simple path to a human does not sit behind the
 * clever one.
 *
 * Every beat changes shape deliberately: a weighted trio, then a full-bleed
 * rail, then a diagram, then a photograph, then a stat grid, then a carousel,
 * then a band. Nothing here is a four-card grid, because three of those in a
 * row is what made this page read as a listings portal.
 *
 * Two sections were cut rather than restyled. `HowItWorks` restated in three
 * text steps what the story section demonstrates with real geometry. The
 * forty-row locality price table moved to `/localities`, where a reader has
 * asked for the whole market.
 */
export function HomeSections({ data }: { data: HomeData }) {
  return (
    <>
      <PropertyRail />
      <RentOrBuy />
      <LocalityDiscovery localities={data.featuredLocalities} totalCount={data.localityCount} />
      <BudgetReach />
      <ScheduleVisit heroImage={data.visitImage} />
      <NearbyLifestyle corridors={data.corridors} />
      <Concierge totals={data.totals} />
      <Shortlist />
      <ClosingCta />
    </>
  );
}

function Band({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`px-5 py-20 md:px-8 md:py-28 ${className}`}>
      <div className="mx-auto max-w-[1440px]">{children}</div>
    </section>
  );
}

export function Lifestyles() {
  const router = useRouter();
  const { addAnchor, setFilters, setUseBounds, toggleLayer, setAnchorsOpen } = useDiscovery();

  async function apply(item: (typeof LIFESTYLES)[number]) {
    setUseBounds(false);
    if (item.filters) setFilters(item.filters);
    if (item.layer) toggleLayer(item.layer as never);
    if (item.anchor) {
      const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(item.anchor.place)}`);
      const j = (await res.json()) as {
        suggestions: { label: string; location: { lat: number; lng: number } | null }[];
      };
      const hit = j.suggestions.find((s) => s.location);
      if (hit?.location) {
        addAnchor({
          label: item.anchor.label,
          kind: item.anchor.kind,
          location: hit.location,
          address: hit.label,
          maxKm: item.anchor.km,
          weight: 1,
        });
        setAnchorsOpen(true);
      }
    }
    router.push("/search");
  }

  return (
    <Band>
      <Reveal>
        <SectionHeader
          eyebrow="Start from your week"
          title="Not every search begins with a budget."
          lead="Each of these sets the map up for you — a real place, a real distance, real results."
        />
      </Reveal>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LIFESTYLES.map((l, i) => (
          <Reveal key={l.title} delay={i * 0.05}>
            <button
              onClick={() => apply(l)}
              className="group flex h-full w-full flex-col rounded-[var(--r-md)] border border-line bg-raised p-5 text-left transition-[border-color,box-shadow,transform] duration-[220ms] [transition-timing-function:var(--ease)] hover:-translate-y-1 hover:border-line-strong hover:shadow-[var(--e2)]"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full border border-line text-muted transition-colors duration-[200ms] group-hover:border-[var(--accent-line)] group-hover:bg-[var(--accent-wash)] group-hover:text-accent">
                <l.icon size={16} strokeWidth={1.75} />
              </span>
              <h3 className="mt-4 text-[16px] font-medium text-ink">{l.title}</h3>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-muted">{l.copy}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-[13px] text-accent">
                Set up the map
                <ArrowUpRight
                  size={13}
                  strokeWidth={2}
                  className="transition-transform duration-[200ms] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </span>
            </button>
          </Reveal>
        ))}
      </div>
    </Band>
  );
}

function Concierge({ totals }: { totals: HomeData["totals"] }) {
  const setAssistantOpen = useDiscovery((s) => s.setAssistantOpen);
  return (
    <Band className="bg-[var(--accent-deep)] text-[var(--ink-inverse)]">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <p className="eyebrow mb-3 text-[var(--data-brass)]">Ask PropIT</p>
          <h2 className="display text-[36px] leading-[1.04] md:text-[46px]">
            Ask PropIT.
          </h2>
          <p className="mt-5 max-w-[44ch] text-[16px] leading-relaxed opacity-70">
            Tell us what you&apos;re looking for. We&apos;ll help you find where it fits — the
            concierge holds the same tools the interface does, and it never invents a number.
          </p>
          <p className="mt-4 max-w-[44ch] text-[14px] leading-relaxed opacity-60">
            It answers from {formatCount(totals.properties)} listings across{" "}
            {formatCount(totals.localities)} localities. If a figure isn&apos;t in the data, it says
            so rather than inventing one.
          </p>
          <button
            onClick={() => setAssistantOpen(true)}
            className="mt-7 inline-flex h-12 items-center gap-2 rounded-[var(--r-pill)] bg-[var(--paper)] px-5 text-[15px] font-medium text-ink transition-opacity hover:opacity-90"
          >
            <Sparkles size={16} strokeWidth={1.75} />
            Open on the map
          </button>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="rounded-[var(--r-lg)] border border-[color-mix(in_srgb,var(--ink-inverse)_16%,transparent)] bg-[color-mix(in_srgb,var(--ink-inverse)_6%,transparent)] p-6">
            <div className="ml-auto w-fit max-w-[85%] rounded-[var(--r-md)] rounded-br-[3px] border border-[color-mix(in_srgb,var(--ink-inverse)_18%,transparent)] px-3.5 py-2.5 text-[14px] leading-relaxed">
              My office is in the Financial District and my son goes to Oakridge Gachibowli. 3 BHK
              under 2 crore.
            </div>
            <div className="mt-5 space-y-1.5">
              <Status>Placed Office at Financial District</Status>
              <Status>Placed School at Oakridge International School</Status>
              <Status>161 homes in the livable zone</Status>
            </div>
            <div className="mt-3.5 space-y-2 text-[14px] leading-relaxed">
              <p>
                Placed both. Within 6 km of your office and 5 km of the school there are{" "}
                <strong className="font-semibold">161 homes</strong> in range — mostly Nanakramguda,
                Gopanpally and Gachibowli.
              </p>
              <p className="text-[12px] opacity-55">
                Travel times are estimated from distance until routing is connected.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </Band>
  );
}

function Status({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px] opacity-60">
      <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-[color-mix(in_srgb,var(--data-brass)_28%,transparent)] text-[var(--data-brass)]">
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden>
          <path
            d="M1.5 4.2L3 5.7L6.5 2.2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {children}
    </div>
  );
}

/**
 * The close.
 *
 * Deliberately on paper, not on another dark slab: the concierge band directly
 * above it is already deep green, and two dark sections in a row read as one
 * long one — the page would end on a thud rather than an exhale. Contours carry
 * the land motif instead, and the page finishes in the same warm ivory it
 * opened in.
 */
export function ClosingCta() {
  return (
    <Band className="border-t border-line !py-14 md:!py-16">
      <Reveal>
        <div className="relative isolate overflow-hidden rounded-[var(--r-canvas)] border border-line bg-raised px-8 py-12 text-center md:px-16 md:py-16">
          <TopoBackdrop mode="light" opacity={0.14} />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_10%,var(--paper-raised)_72%)]" />
          <div className="relative">
            <h2 className="display mx-auto max-w-[16ch] text-[36px] leading-[1.04] text-ink md:text-[52px]">
              Find where your life fits.
            </h2>
            <p className="mx-auto mt-5 max-w-[46ch] text-[16px] leading-relaxed text-muted">
              Start with the places that matter. PropIT will help you discover the homes around
              them.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/search"
                className="inline-flex h-12 items-center rounded-[var(--r-pill)] bg-accent px-6 text-[15px] font-medium text-[var(--accent-ink)] transition-colors duration-[160ms] hover:bg-accent-hover"
              >
                Explore homes
              </Link>
              <button
                onClick={() => useDiscovery.getState().setAssistantOpen(true)}
                className="inline-flex h-12 items-center rounded-[var(--r-pill)] border border-line-strong px-6 text-[15px] font-medium text-ink transition-colors duration-[160ms] hover:border-[var(--accent)]"
              >
                Ask PropIT
              </button>
            </div>
          </div>
        </div>
      </Reveal>
    </Band>
  );
}
