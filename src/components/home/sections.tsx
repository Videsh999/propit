"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Briefcase, GraduationCap, TramFront, TreePine } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeader } from "@/components/ui/section-header";
import { LocalityDiscovery } from "@/components/home/locality-discovery";
import { RentOrBuy } from "@/components/home/rent-or-buy";
import { NearbyLifestyle, type CorridorReach } from "@/components/home/nearby-lifestyle";
import { Shortlist } from "@/components/home/shortlist";
import { ScheduleVisit } from "@/components/home/schedule-visit";
import { BudgetReach } from "@/components/home/budget-reach";
import { TopoBackdrop } from "@/components/ui/topo-backdrop";
import { useDiscovery } from "@/store/discovery";
import type { Locality, PropertyType } from "@/types";

export interface HomeData {
  /** A handful of corridors, written up rather than tabulated. */
  featuredLocalities: Locality[];
  localityCount: number;
  corridors: CorridorReach[];
  /** One real architectural image for the viewing section. */
  visitImage: string;
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

export function HomeSections({ data }: { data: HomeData }) {
  return (
    <>
      <RentOrBuy />
      <LocalityDiscovery localities={data.featuredLocalities} totalCount={data.localityCount} />
      <BudgetReach />
      <ScheduleVisit heroImage={data.visitImage} />
      <NearbyLifestyle corridors={data.corridors} />
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
