import type { Metadata } from "next";
import { SellWizard } from "@/components/sell/sell-wizard";
import { allLocalities } from "@/lib/data/repository";

export const metadata: Metadata = {
  title: "List your property",
  description:
    "List a home for sale or rent on PropIT. Place it precisely on the map, add the details buyers actually ask about, and reach people searching that exact area.",
};

export default function SellPage() {
  const localities = allLocalities().map((l) => ({
    slug: l.slug,
    name: l.name,
    center: l.center,
    boundary: l.boundary,
    avgPriceSqft: l.avgPriceSqft,
  }));
  return (
    <main>
      <SellWizard localities={localities} />
    </main>
  );
}
