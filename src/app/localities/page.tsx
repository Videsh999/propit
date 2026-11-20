import { prepareStore } from "@/lib/data/store";
import type { Metadata } from "next";
import { allLocalities } from "@/lib/data/repository";
import { LocalityIndex } from "@/components/locality/locality-index";

export const metadata: Metadata = {
  title: "Explore Hyderabad localities",
  description:
    "Every locality PropIT covers in Hyderabad, with average pricing, inventory, rental yield and year-on-year movement.",
};

export default async function LocalitiesPage() {
  await prepareStore();
  const localities = allLocalities();

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-7 md:px-8 md:py-10">
      <header className="mb-8 max-w-[70ch]">
        <p className="eyebrow mb-3">Explore Hyderabad · {localities.length} localities</p>
        <h1 className="display text-[42px] leading-[1.02] text-ink md:text-[58px]">
          Localities in Hyderabad.
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-muted">
          Explore neighbourhoods side by side, with prices, available homes and locality details.
        </p>
      </header>

      <LocalityIndex localities={localities} />
    </main>
  );
}
