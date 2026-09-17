import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Calendar, Layers3, Ruler } from "lucide-react";
import {
  getProjectBySlug, getDeveloper, getLocality, getProjectProperties, nearbyPlaces,
} from "@/lib/data/repository";
import { Img } from "@/components/ui/img";
import { QualityBadge, Tag } from "@/components/ui/badge";
import { AMENITY_BY_SLUG } from "@/lib/data/developers";
import { POI_CATEGORY_LABEL } from "@/lib/data/pois";
import { formatArea, formatPrice, formatPriceSqft, projectStatusLabel } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) return { title: "Project not found" };
  const locality = getLocality(project.localityId);
  const developer = getDeveloper(project.developerId);
  const title = `${project.name} by ${developer?.name ?? "developer"}`;
  const description = `${project.name} in ${locality?.name ?? "Hyderabad"} — ${
    project.configurations.join(", ")
  } from ${formatPrice(project.priceMin)}. ${projectStatusLabel(project.status)}, possession ${
    project.possessionDate
  }.`;
  return {
    title,
    description,
    openGraph: { title, description, images: [project.heroImage] },
    alternates: { canonical: `/project/${slug}` },
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();

  const locality = getLocality(project.localityId)!;
  const developer = getDeveloper(project.developerId);
  const units = getProjectProperties(project.id);
  const nearby = nearbyPlaces(project.location, null, 6, 2);

  return (
    <main className="pb-24">
      <section className="relative">
        <Img
          src={project.heroImage}
          alt={project.name}
          seed={project.id}
          className="h-[52vh] max-h-[540px] min-h-[320px] w-full"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.82)] via-[rgba(0,0,0,0.15)] to-transparent" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-[1440px] px-5 pb-8 md:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">
                {projectStatusLabel(project.status)}
              </span>
              {project.reraVerified && (
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">
                  RERA {project.reraNumber}
                </span>
              )}
            </div>
            <h1 className="display mt-2.5 text-[44px] leading-none text-white md:text-[64px]">
              {project.name}
            </h1>
            <p className="mt-2 text-[15px] text-white/80">
              {developer?.name} ·{" "}
              <Link href={`/locality/${locality.slug}`} className="underline-offset-4 hover:underline">
                {locality.name}
              </Link>
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-5 md:px-8">
        <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-md)] border border-line bg-[var(--line)] md:grid-cols-4">
          <Stat icon={Building2} label="Price range" value={`${formatPrice(project.priceMin)} – ${formatPrice(project.priceMax)}`} />
          <Stat icon={Layers3} label="Configurations" value={project.configurations.join(", ")} />
          <Stat icon={Calendar} label="Possession" value={project.possessionDate} />
          <Stat icon={Ruler} label="Land area" value={`${project.landAreaAcres} acres`} />
        </div>

        <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <h2 className="display text-[28px] text-ink">About the project</h2>
            <p className="mt-4 max-w-[68ch] text-[16px] leading-relaxed text-muted">
              {project.description}
            </p>

            <dl className="mt-8 grid gap-x-10 gap-y-2.5 sm:grid-cols-2">
              <Spec label="Towers" value={String(project.towers)} />
              <Spec label="Floors" value={String(project.floors)} />
              <Spec label="Total units" value={String(project.unitsTotal)} />
              <Spec label="Available" value={`${project.unitsAvailable} units`} />
            </dl>

            {project.gallery.length > 1 && (
              <>
                <h2 className="display mt-14 text-[28px] text-ink">Gallery</h2>
                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
                  {project.gallery.slice(1, 7).map((g, i) => (
                    <Img
                      key={i}
                      src={g}
                      alt={`${project.name} ${i + 1}`}
                      seed={project.id + i}
                      className="aspect-[4/3] w-full rounded-[var(--r-md)]"
                      sizes="(max-width: 768px) 50vw, 33vw"
                    />
                  ))}
                </div>
              </>
            )}

            {project.amenities.length > 0 && (
              <>
                <h2 className="display mt-14 text-[28px] text-ink">Amenities</h2>
                <ul className="mt-5 flex flex-wrap gap-1.5">
                  {project.amenities.map((a) => (
                    <li key={a}>
                      <span className="inline-flex h-9 items-center rounded-full border border-line bg-raised px-3.5 text-[13px] text-muted">
                        {AMENITY_BY_SLUG.get(a as never)?.name ?? a}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {units.length > 0 && (
              <>
                <h2 className="display mt-14 text-[28px] text-ink">
                  Available homes
                  <span className="tnum ml-3 text-[16px] font-normal text-faint">{units.length}</span>
                </h2>
                <ul className="mt-5 divide-y divide-[var(--line)] border-y border-line">
                  {units.slice(0, 10).map((u) => (
                    <li key={u.id}>
                      <Link
                        href={`/property/${u.slug}`}
                        className="flex items-center gap-4 py-3.5 transition-colors hover:bg-sunk"
                      >
                        <Img src={u.images[0]?.url ?? ""} alt={u.title} seed={u.id} className="h-14 w-20 shrink-0 rounded-[var(--r-sm)]" sizes="90px" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium text-ink">{u.title}</span>
                          <span className="tnum block text-[12px] text-faint">
                            {u.bedrooms ? `${u.bedrooms} BHK · ` : ""}
                            {formatArea(u.builtupAreaSqft)} · floor {u.floor}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="tnum block text-[15px] font-semibold text-ink">{formatPrice(u.price)}</span>
                          <span className="tnum block text-[11px] text-faint">{formatPriceSqft(u.pricePerSqft)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <aside className="lg:sticky lg:top-[92px] lg:h-fit">
            <div className="rounded-[var(--r-lg)] border border-line bg-raised p-5">
              {developer && (
                <>
                  <h3 className="eyebrow">Developer</h3>
                  <div className="mt-2.5 flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--r-sm)] bg-inverse text-[14px] font-semibold text-[var(--ink-inverse)]">
                      {developer.logoMark}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-ink">{developer.name}</p>
                      <p className="tnum text-[11px] text-faint">
                        {developer.projectsDelivered} delivered · since {developer.establishedYear}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-[12px] leading-relaxed text-muted">{developer.about}</p>
                </>
              )}

              <div className="mt-5 border-t border-line pt-4">
                <h3 className="eyebrow mb-2.5">Nearby</h3>
                <ul className="space-y-1.5">
                  {nearby.slice(0, 6).map((p) => (
                    <li key={p.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="min-w-0 truncate text-muted">
                        {p.name.split(",")[0]}
                        <span className="ml-1 text-[10px] text-faint">
                          {POI_CATEGORY_LABEL[p.category]}
                        </span>
                      </span>
                      <span className="tnum shrink-0 text-faint">{p.distanceKm} km</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                <QualityBadge quality={project.dataQuality} />
                {project.reraVerified && <Tag>RERA verified</Tag>}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-faint">
                Specifications and possession dates are as listed by the developer. Verify RERA
                details independently before transacting.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="bg-paper px-4 py-4">
      <div className="flex items-center gap-1.5 text-[11px] text-faint">
        <Icon size={12} strokeWidth={1.75} />
        {label}
      </div>
      <div className="tnum mt-1 text-[16px] font-semibold text-ink">{value}</div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-1.5">
      <dt className="text-[13px] text-faint">{label}</dt>
      <dd className="tnum text-[13px] text-ink">{value}</dd>
    </div>
  );
}
