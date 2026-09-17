import type { Metadata } from "next";
import { allLocalities } from "@/lib/data/repository";
import { LocalityIndex } from "@/components/locality/locality-index";

export const metadata: Metadata = {
  title: "Explore Hyderabad localities",
  description:
    "Every locality PropIT covers in Hyderabad, with average pricing, inventory, rental yield and year-on-year movement.",
};

export default function LocalitiesPage() {
  const localities = allLocalities();

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-16 md:px-8 md:py-20">
      <header className="max-w-[58ch]">
        <p className="eyebrow mb-3">Explore Hyderabad · {localities.length} localities</p>
        <h1 className="display text-[42px] leading-[1.02] text-ink md:text-[58px]">
          Forty localities, honestly measured.
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-muted">
          Pricing, inventory and momentum for every corridor PropIT covers. Figures are modelled
          from listed inventory — they are estimates, and we label them as such.
        </p>
      </header>

      <div className="mt-20 md:mt-28">
        <LocalityIndex localities={localities} />
      </div>
    </main>
  );
}
