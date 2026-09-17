import type { Metadata } from "next";
import Link from "next/link";
import { getStore } from "@/lib/data/store";
import { buildStoryData } from "@/lib/story/story-data";
import { LifeDiagram } from "@/components/about/life-diagram";
import { formatCount } from "@/lib/format";

export const metadata: Metadata = {
  title: "About PropIT",
  description:
    "Why PropIT is built around a map and the places that matter in your life, rather than an endless list of property.",
};

export default function AboutPage() {
  const store = getStore();

  return (
    <main className="mx-auto max-w-[760px] px-5 py-20 md:px-8 md:py-28">
      <p className="eyebrow mb-3">About</p>
      <h1 className="display text-[44px] leading-[1.04] text-ink md:text-[60px]">
        Most portals make you search. PropIT asks where you need to be.
      </h1>

      <div className="mt-10 space-y-6 text-[17px] leading-relaxed text-muted">
        <p>
          Every property site starts from the same place: a list, and a set of filters to shorten it.
          You narrow by budget and bedrooms, then scroll until something looks right, then open a
          second tab to work out how far it is from your office.
        </p>
        <p className="text-ink">
          That&apos;s backwards. Where you live is decided by the places you already have to be.
        </p>
        <p>
          PropIT is built around that. You drop your office on the map. Your child&apos;s school. Your
          parents&apos; house. You say how far is too far for each. PropIT works out the region that
          satisfies all of them at once, paints it, and shows you what&apos;s inside — ranked by how
          well each home actually fits, with the arithmetic shown.
        </p>
      </div>

      {/* The claim above, measured. */}
      <LifeDiagram data={buildStoryData()} />

      <div className="space-y-6 text-[17px] leading-relaxed text-muted">
        <h2 className="display pt-6 text-[28px] text-ink">What we won&apos;t do</h2>
        <p>
          Real estate runs on numbers that are easy to assert and hard to check. So PropIT draws a
          hard line: every figure on this site is tagged as{" "}
          <strong className="font-medium text-ink">verified</strong>,{" "}
          <strong className="font-medium text-ink">listed</strong> or{" "}
          <strong className="font-medium text-ink">estimated</strong>, and they are rendered
          differently so you can tell at a glance.
        </p>
        <p>
          The assistant can reason, compare and recommend. It cannot author a number. If a price,
          possession date or RERA registration isn&apos;t in the data, it will tell you it
          doesn&apos;t know rather than produce something plausible.
        </p>
        <p>
          Travel times are currently approximated from straight-line distance — Hyderabad&apos;s roads
          add roughly a third to any direct line. Every one of those numbers is labelled as an
          estimate. When a routing provider is connected, the labels change with the data.
        </p>
        <h2 className="display pt-6 text-[28px] text-ink">Where it stands</h2>
        <p>
          Hyderabad is the launch geography — {formatCount(store.properties.length)} homes across{" "}
          {formatCount(store.localities.length)} localities and {formatCount(store.projects.length)}{" "}
          projects, with {formatCount(store.pois.length)} mapped places to measure against. Nothing in
          the architecture is Hyderabad-specific; the city is a row in a table.
        </p>
        <p className="text-[15px] text-faint">
          This is development data, built to demonstrate the product end to end. It is not live market
          inventory, and no listing here is for sale.
        </p>
      </div>

      <div className="mt-12 flex flex-wrap gap-3 border-t border-line pt-8">
        <Link
          href="/search"
          className="inline-flex h-12 items-center rounded-[var(--r-pill)] bg-accent px-5 text-[15px] font-medium text-[var(--accent-ink)] transition-colors hover:bg-accent-hover"
        >
          Open the map
        </Link>
        <Link
          href="/localities"
          className="inline-flex h-12 items-center rounded-[var(--r-pill)] border border-line px-5 text-[15px] font-medium text-ink transition-colors hover:bg-sunk"
        >
          Browse localities
        </Link>
      </div>
    </main>
  );
}
