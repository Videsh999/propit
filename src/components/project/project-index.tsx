"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Img } from "@/components/ui/img";
import { Reveal } from "@/components/ui/reveal";
import { QualityBadge, Tag } from "@/components/ui/badge";
import { useDiscovery } from "@/store/discovery";
import { formatPrice, projectStatusLabel } from "@/lib/format";
import type { LatLng, Project, ProjectStatus } from "@/types";
import { cn } from "@/lib/utils";

export interface IndexProject extends Project {
  developerName: string;
  localityName: string;
  localitySlug: string;
}

/** Launch first, keys-in-hand last — the order a buyer thinks in. */
const ORDER: ProjectStatus[] = ["new_launch", "under_construction", "ready", "upcoming"];

/**
 * The project index.
 *
 * Three developments are written up at full size; the remaining ninety-odd are
 * an index — a line each, grouped by where they are in their life. A page of
 * identical thumbnails flattens a ₹4 Cr tower and a plotted development into the
 * same object, and makes a hundred entries feel like a catalogue to endure.
 * Two registers let the page recommend and still list everything.
 */
export function ProjectIndex({
  projects,
  leadIds,
}: {
  projects: IndexProject[];
  /** Chosen on the server by the same curation the homepage showcase uses. */
  leadIds: string[];
}) {
  const lead = new Set(leadIds);
  const leads = projects.filter((p) => lead.has(p.id));
  const rest = projects.filter((p) => !lead.has(p.id));

  const grouped = new Map<ProjectStatus, IndexProject[]>();
  for (const p of rest) {
    const arr = grouped.get(p.status);
    if (arr) arr.push(p);
    else grouped.set(p.status, [p]);
  }
  for (const list of grouped.values()) list.sort((a, b) => b.priceMin - a.priceMin);

  return (
    <>
      <section className="space-y-20 md:space-y-28">
        {leads.map((p, i) => (
          <LeadProject key={p.id} project={p} flip={i % 2 === 1} index={i} />
        ))}
      </section>

      <section className="mt-24 md:mt-32">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-5">
            <h2 className="display text-[28px] leading-tight text-ink md:text-[36px]">
              The rest of the pipeline.
            </h2>
            <p className="max-w-[40ch] text-[13px] leading-relaxed text-muted">
              Grouped by where each development is in its life. RERA status is shown where the
              registration is on record.
            </p>
          </div>
        </Reveal>

        {ORDER.filter((s) => grouped.has(s)).map((status) => (
          <div key={status} className="mt-12">
            <h3 className="eyebrow mb-1">
              {projectStatusLabel(status)}
              <span className="tnum ml-2 text-faint">{grouped.get(status)!.length}</span>
            </h3>
            <ul>
              {grouped.get(status)!.map((p) => (
                <ProjectRow key={p.id} project={p} />
              ))}
            </ul>
          </div>
        ))}
      </section>
    </>
  );
}

function LeadProject({
  project: p,
  flip,
  index,
}: {
  project: IndexProject;
  flip: boolean;
  index: number;
}) {
  return (
    <Reveal delay={index * 0.04}>
      <article className="grid items-center gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <Link
          href={`/project/${p.slug}`}
          className={cn("group block overflow-hidden rounded-[var(--r-lg)]", flip && "lg:order-2")}
        >
          <Img
            src={p.heroImage}
            alt={`${p.name} in ${p.localityName}`}
            seed={p.id}
            sizes="(max-width: 1024px) 100vw, 55vw"
            className="aspect-[4/3] w-full transition-transform duration-[700ms] [transition-timing-function:var(--ease)] group-hover:scale-[1.02]"
          />
        </Link>

        <div className={cn(flip && "lg:order-1")}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Tag>{projectStatusLabel(p.status)}</Tag>
            {p.reraVerified && <QualityBadge quality="verified" label="RERA" />}
          </div>
          <p className="eyebrow mb-2">
            {p.developerName} · {p.localityName}
          </p>
          <h2 className="display text-[34px] leading-[1.04] text-ink md:text-[46px]">
            <Link href={`/project/${p.slug}`} className="transition-colors hover:text-accent">
              {p.name}
            </Link>
          </h2>
          <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-muted">{p.description}</p>

          {/* Price needs the widest column — a range breaking across two lines
              reads as two numbers rather than one span. */}
          <dl className="mt-7 grid max-w-[30rem] grid-cols-2 gap-x-8 gap-y-5 border-t border-line pt-6 sm:grid-cols-[1.5fr_1fr_1fr]">
            <Field
              label="Price"
              nowrap
              value={`${formatPrice(p.priceMin)} – ${formatPrice(p.priceMax)}`}
            />
            <Field label="Configurations" value={p.configurations.join(" & ")} />
            <Field
              label="Possession"
              value={new Date(p.possessionDate).toLocaleDateString("en-IN", {
                month: "short",
                year: "numeric",
              })}
            />
          </dl>

          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href={`/project/${p.slug}`}
              className="group inline-flex items-center gap-1.5 text-[15px] text-ink transition-colors hover:text-accent"
            >
              Explore project
              <ArrowUpRight
                size={15}
                strokeWidth={2}
                className="text-accent transition-transform duration-[180ms] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
            <ShowOnMap location={p.location} localitySlug={p.localitySlug} />
          </div>
        </div>
      </article>
    </Reveal>
  );
}

function Field({ label, value, nowrap }: { label: string; value: string; nowrap?: boolean }) {
  return (
    <div>
      <dt className="eyebrow mb-1">{label}</dt>
      <dd className={cn("tnum text-[15px] font-medium text-ink", nowrap && "whitespace-nowrap")}>
        {value}
      </dd>
    </div>
  );
}

function ProjectRow({ project: p }: { project: IndexProject }) {
  return (
    <li className="group border-b border-line transition-colors duration-[160ms] hover:bg-sunk">
      <div className="flex items-center gap-4 py-4">
        <Link href={`/project/${p.slug}`} className="shrink-0">
          <Img
            src={p.heroImage}
            alt=""
            seed={p.id}
            sizes="72px"
            className="h-[54px] w-[72px] rounded-[var(--r-sm)]"
          />
        </Link>

        <Link href={`/project/${p.slug}`} className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[16px] font-medium text-ink transition-colors group-hover:text-accent">
              {p.name}
            </span>
            {p.reraVerified && (
              <span className="eyebrow shrink-0 rounded-full border border-[var(--accent-line)] px-1.5 py-0.5 text-[9px] text-accent">
                RERA
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-muted">
            {p.developerName} · {p.localityName}
          </span>
        </Link>

        <span className="tnum hidden shrink-0 text-right text-[13px] text-muted sm:block">
          {p.configurations.join(", ")}
        </span>

        <span className="tnum shrink-0 text-right text-[14px] text-ink">
          <span className="text-faint">from </span>
          {formatPrice(p.priceMin)}
        </span>

        <span className="hidden shrink-0 md:block">
          <ShowOnMap location={p.location} localitySlug={p.localitySlug} compact />
        </span>
      </div>
    </li>
  );
}

/** A project stays attached to its ground — this is how you go and look at it. */
function ShowOnMap({
  location,
  localitySlug,
  compact,
}: {
  location: LatLng;
  localitySlug: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const { flyTo, selectLocality, setUseBounds } = useDiscovery();

  return (
    <button
      onClick={() => {
        setUseBounds(false);
        selectLocality(localitySlug);
        flyTo(location, 14.5);
        router.push("/search");
      }}
      className={cn(
        "inline-flex items-center gap-1.5 text-muted transition-colors hover:text-ink",
        compact ? "text-[13px] opacity-0 group-hover:opacity-100" : "text-[15px]",
      )}
    >
      Show on the map
      <ArrowUpRight size={compact ? 13 : 15} strokeWidth={2} />
    </button>
  );
}
