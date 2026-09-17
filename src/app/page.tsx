import {
  allLocalities,
  corridorReach,
  featuredProjects,
} from "@/lib/data/repository";
import { getStore } from "@/lib/data/store";
import { Hero } from "@/components/home/hero";
import { HomeSections, type HomeData } from "@/components/home/sections";

export default function HomePage() {
  const store = getStore();
  const localities = allLocalities();

  const mapLocalities = localities.map((l) => ({
    slug: l.slug,
    name: l.name,
    center: l.center,
    boundary: l.boundary,
    avgPriceSqft: l.avgPriceSqft,
    inventoryCount: l.inventoryCount,
  }));

  const data: HomeData = {
    // The corridors carrying the most inventory — the ones a reader is most
    // likely to already be weighing.
    featuredLocalities: [...localities]
      .sort((a, b) => b.inventoryCount - a.inventoryCount)
      .slice(0, 5),
    localityCount: localities.length,
    // The corridors a Hyderabad buyer is usually choosing between, west to east.
    corridors: corridorReach(
      ["financial-district", "kokapet", "gachibowli", "madhapur", "jubilee-hills"],
      ["school", "hospital", "metro", "office_hub", "mall", "park"],
    ),
    // Reuses a real project's photograph rather than importing another asset.
    visitImage: featuredProjects(1)[0]?.heroImage ?? "",
    totals: {
      properties: store.properties.length,
      projects: store.projects.length,
      localities: localities.length,
    },
  };

  return (
    <main>
      {/*
        The map is the product; everything below argues for it.

        There used to be an explainer between these two — "A portal filters
        lists, PropIT reads geography" — describing a mechanic the hero directly
        above it already performs. It now illustrates the same claim on /about,
        where the argument is made in words and needs the measurement.
      */}
      <Hero localities={mapLocalities} />
      <HomeSections data={data} />
    </main>
  );
}
