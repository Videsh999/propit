import type { Metadata } from "next";
import { allLocalities, allProjects, getLocality } from "@/lib/data/repository";
import { getStore } from "@/lib/data/store";
import { FeaturedProperties, Movers, Developers } from "@/components/insights/sections";
import { Lifestyles, ClosingCta } from "@/components/home/sections";
import { LocalityDiscovery } from "@/components/home/locality-discovery";

export const metadata: Metadata = {
  title: "Insights",
  description:
    "Where Hyderabad prices moved this year, which corridors are absorbing inventory, and ways to start a search from your own week rather than a budget.",
};

/**
 * Insights.
 *
 * The PropIT design tightened the homepage to six sections. The lifestyle entry
 * points, featured homes, movers and developer showcase still earn their place —
 * they just belong on their own page rather than competing with the map.
 */
export default function InsightsPage() {
  const store = getStore();
  const localities = allLocalities();
  const projects = allProjects();

  return (
    <main>
      <section className="border-b border-line px-5 pb-10 pt-16 md:px-8 md:pb-14 md:pt-20">
        <div className="mx-auto max-w-[1440px]">
          <p className="eyebrow mb-3">Insights</p>
          <h1 className="display max-w-[20ch] text-[42px] leading-[1.02] text-ink md:text-[58px]">
            What the city is doing, and where to start.
          </h1>
          <p className="mt-5 max-w-[56ch] text-[16px] leading-relaxed text-muted">
            Figures are modelled from listed inventory across {localities.length} localities — estimates,
            not recorded transactions. We would rather say so than dress them up.
          </p>
        </div>
      </section>

      <Movers localities={[...localities].sort((a, b) => b.momentumPct - a.momentumPct).slice(0, 6)} />
      <Lifestyles />
      <LocalityDiscovery
        localities={[...localities].sort((a, b) => b.inventoryCount - a.inventoryCount).slice(0, 5)}
        totalCount={localities.length}
      />
      <FeaturedProperties
        properties={store.properties
          .filter((p) => p.listingType === "buy" && p.isVerified)
          .sort((a, b) => b.viewCount - a.viewCount)
          .slice(0, 8)
          .map((p) => ({ ...p, localityName: getLocality(p.localityId)?.name ?? "" }))}
      />
      <Developers
        developers={store.developers
          .map((d) => ({ ...d, projectCount: projects.filter((p) => p.developerId === d.id).length }))
          .sort((a, b) => b.projectCount - a.projectCount)
          .slice(0, 4)}
      />
      <ClosingCta />
    </main>
  );
}
