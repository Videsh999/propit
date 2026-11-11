import type { Metadata } from "next";
import { allLocalities } from "@/lib/data/repository";
import { getStore } from "@/lib/data/store";
import { Suspense } from "react";
import { DiscoveryView } from "@/components/search/discovery-view";
import { SearchUrlSync } from "@/components/search/url-sync";

export const metadata: Metadata = {
  title: "Search homes in Hyderabad",
  description:
    "Search Hyderabad property on a live map. Filter by budget, bedrooms and type, or anchor the search to your office and your child's school.",
};

export default function SearchPage() {
  const localities = allLocalities().map((l) => ({
    slug: l.slug,
    name: l.name,
    center: l.center,
    boundary: l.boundary,
    avgPriceSqft: l.avgPriceSqft,
  }));
  const store = getStore();
  const pois = store.pois;
  // Projects are their own layer on the map — a development is a place you
  // visit, not a unit you buy.
  const projects = store.projects.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    localityId: p.localityId,
    lat: p.location.lat,
    lng: p.location.lng,
    priceMin: p.priceMin,
  }));

  return (
    <main>
      <Suspense fallback={null}>
        <SearchUrlSync />
      </Suspense>
      <DiscoveryView localities={localities} pois={pois} projects={projects} />
    </main>
  );
}
