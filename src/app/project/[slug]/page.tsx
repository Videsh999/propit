import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import {
  allProjects, getProjectBySlug, getDeveloper, getLocality, getProjectProperties, nearbyPlaces,
} from "@/lib/data/repository";
import { haversineKm } from "@/lib/geo/distance";
import { Img } from "@/components/ui/img";
import { Tag } from "@/components/ui/badge";
import { ProjectCard } from "@/components/cards/project-card";
import { ProjectInventory } from "@/components/project/project-inventory";
import { AMENITIES } from "@/lib/data/developers";
import { POI_CATEGORY_LABEL } from "@/lib/data/pois";
import { formatArea, formatCount, formatDistance, formatPrice, projectStatusLabel } from "@/lib/format";
import type { Project, ProjectSpecification } from "@/types";

const SECTIONS = [
  ["overview", "Overview"], ["inventory", "Properties"], ["media", "Photos & video"],
  ["plans", "Plans & documents"], ["amenities", "Amenities"], ["specifications", "Specifications"],
  ["location", "Location"], ["builder", "Builder"], ["reviews", "Reviews"], ["faqs", "FAQs"],
];

const SPECIFICATIONS: [ProjectSpecification, string][] = [
  ["superStructure", "Super structure"], ["doorsWindows", "Doors & windows"],
  ["wallFinishes", "Wall finishes"], ["ceilingFinishes", "Ceiling finishes"], ["flooring", "Flooring"],
  ["tileCladding", "Tile cladding / dado"], ["kitchen", "Kitchen"], ["bathrooms", "Bathrooms / toilets"],
  ["electrical", "Electrical"], ["airConditioning", "Air conditioning"], ["telecom", "Telecom"],
  ["internet", "Internet"], ["lifts", "Lifts"], ["waterTreatment", "Water & sewage treatment (WTP / STP)"],
  ["security", "Security / BMS"], ["fireSafety", "Fire & safety"],
];

const MISSING = "Not supplied";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) return { title: "Project not found" };
  const locality = getLocality(project.localityId);
  const developer = getDeveloper(project.developerId);
  const title = developer ? `${project.name} by ${developer.name}` : project.name;
  const description = `${project.name} in ${locality?.name ?? "Hyderabad"} · ${projectStatusLabel(project.status)} · From ${formatPrice(project.priceMin)}.`;
  return {
    title, description,
    openGraph: { title, description, images: [project.heroImage] },
    alternates: { canonical: `/project/${slug}` },
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();

  const profile = project.profile ?? {};
  const locality = getLocality(project.localityId);
  const developer = getDeveloper(project.developerId);
  const units = getProjectProperties(project.id);
  const listedHomes = units.filter((unit) => unit.propertyType !== "plot" && unit.propertyType !== "commercial");
  const sizes = listedHomes.map((unit) => unit.builtupAreaSqft).filter((size) => size > 0);
  const range = profile.unitSizeRangeSqft ?? (sizes.length ? [Math.min(...sizes), Math.max(...sizes)] : null);
  const sizeRange = range ? (range[0] === range[1] ? formatArea(range[0]) : `${formatCount(range[0])}–${formatArea(range[1])}`) : null;
  const nearby = nearbyPlaces(project.location, null, 6, 2).slice(0, 8);
  const projects = allProjects().filter(({ id }) => id !== project.id);
  const rankedByDistance = projects
    .map((candidate) => ({ candidate, distance: haversineKm(project.location, candidate.location) }))
    .sort((a, b) => a.distance - b.distance)
    .map(({ candidate }) => candidate);
  const related = rankedByDistance.slice(0, 4);
  const similar = rankedByDistance.filter((candidate) =>
    !related.includes(candidate) && candidate.configurations.some((configuration) => project.configurations.includes(configuration)),
  ).slice(0, 4);
  const otherProjects = projects.filter((candidate) =>
    candidate.developerId === project.developerId && !related.includes(candidate) && !similar.includes(candidate),
  ).slice(0, 4);
  const gallery = [...new Set(project.gallery)].filter((url) => url !== project.heroImage);
  const amenities = new Map<string, string[]>();
  for (const slug of new Set(project.amenities)) {
    const item = AMENITIES.find((amenity) => amenity.slug === slug);
    const category = item?.category ?? "Other amenities";
    amenities.set(category, [...(amenities.get(category) ?? []), item?.name ?? slug]);
  }
  const plans = new Map<string, NonNullable<typeof profile.floorPlans>>();
  for (const configuration of project.configurations) plans.set(configuration, []);
  for (const plan of profile.floorPlans ?? []) {
    plans.set(plan.configuration, [...(plans.get(plan.configuration) ?? []), plan]);
  }
  const reviews = profile.reviews ?? [];
  const rating = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : null;
  const faqs = profile.faqs?.length ? profile.faqs : [
    { question: "Who is the builder?", answer: developer?.name ?? MISSING },
    { question: "When is possession listed?", answer: project.possessionDate || MISSING },
    { question: "What is the listed RERA reference?", answer: project.reraNumber || MISSING },
    { question: "Which configurations are listed?", answer: project.configurations.join(", ") || MISSING },
  ];
  const facts: [string, ReactNode][] = [
    ["Project type", profile.type], ["Property category", profile.category],
    ["Current status", projectStatusLabel(project.status)], ["RERA number", project.reraNumber],
    ["Towers / blocks", formatCount(project.towers)], ["Total units", formatCount(project.unitsTotal)],
    ["Developer-listed available units", formatCount(project.unitsAvailable)],
    ["Number of floors", formatCount(project.floors)], ["Land extent", `${project.landAreaAcres} acres`],
    [profile.unitSizeRangeSqft ? "Unit sizes" : "Built-up sizes in linked listings", sizeRange],
    ["Unit facing", profile.unitFacings?.length ? profile.unitFacings.join(", ") : null],
    ["Launch date", profile.launchDate], ["Completion date", profile.completionDate],
    ["RERA completion date", profile.reraCompletionDate], ["Listed possession", project.possessionDate],
    ["Density", project.landAreaAcres > 0 ? `${(project.unitsTotal / project.landAreaAcres).toFixed(1)} units per acre` : null],
    ["FSI", profile.floorSpaceIndex], ["Open area", profile.openAreaPercent == null ? null : `${profile.openAreaPercent}%`],
    ["Carpet area share", profile.carpetAreaPercent == null ? null : `${profile.carpetAreaPercent}%`],
    ["Project age", profile.ageYears == null ? null : `${profile.ageYears} years`],
  ];

  return (
    <main className="mx-auto max-w-[1440px] px-4 pb-14 pt-5 sm:px-8">
      <div className="relative isolate overflow-hidden rounded-[var(--r-canvas)] bg-accent-deep text-white">
        <Img src={project.heroImage} alt={project.name} className="h-[360px] w-full md:h-[460px]" priority sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
        <header className="absolute inset-x-0 bottom-0 p-5 md:p-9">
          <div className="flex flex-wrap gap-2 text-xs">
            {[projectStatusLabel(project.status), profile.type, profile.category].filter(Boolean).map((label) => (
              <span key={label} className="rounded-full border border-white/35 bg-black/30 px-3 py-1.5">{label}</span>
            ))}
          </div>
          <h1 className="mt-3 font-[family-name:var(--font-editorial)] text-4xl leading-none md:text-6xl">{project.name}</h1>
          <p className="mt-2 text-sm text-white/90">{developer?.name ?? "Builder details not supplied"}{locality && <> · <Link href={`/locality/${locality.slug}`} className="underline underline-offset-4">{locality.name}</Link></>}</p>
        </header>
      </div>

      <nav aria-label="Project sections" className="my-4 flex gap-5 overflow-x-auto whitespace-nowrap border-b border-line px-1 py-3 text-sm font-semibold text-accent">
        {SECTIONS.map(([id, label]) => <a href={`#${id}`} key={id} className="hover:underline">{label}</a>)}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-6">
          <Section id="overview" title="Project overview">
            <p className="mb-4 leading-relaxed text-muted">{project.description}</p>
            <h3 className="mb-2 text-sm font-semibold">Project details</h3>
            <Facts rows={facts} />
            <h3 className="mb-2 mt-5 text-sm font-semibold">Project highlights</h3>
            <TextList items={profile.highlights} empty="Builder highlights not supplied." />
          </Section>

          <Section id="inventory" title="Available properties">
            <ProjectInventory listings={units.map(({ id, slug, title, listingType, propertyType, price, rentMonthly, bedrooms, builtupAreaSqft, images }) => ({
              id, slug, title, listingType, propertyType, price, rentMonthly, bedrooms, builtupAreaSqft, image: images[0]?.url,
            }))} />
          </Section>

          <Section id="media" title="Photos & video">
            {gallery.length > 0 && <ul className="flex snap-x gap-3 overflow-x-auto pb-3">
              {gallery.map((url, index) => (
                <li key={url} className="w-[72%] shrink-0 snap-start sm:w-[42%]">
                  <a href={url} aria-label={`Open project photo ${index + 1}`}>
                    <Img src={url} alt={`${project.name} gallery photo ${index + 1}`} className="aspect-[4/3] w-full rounded-xl" sizes="420px" />
                  </a>
                </li>
              ))}
            </ul>}
            {gallery.length > 0 && <p className="mb-3 text-xs text-muted">Photos in the demo inventory are illustrative.</p>}
            {profile.videoUrl
              ? <video controls preload="none" poster={project.heroImage} src={profile.videoUrl} className="mt-3 w-full rounded-xl" aria-label={`${project.name} video tour`} />
              : <p className="text-sm text-muted">Project video not supplied.</p>}
          </Section>

          <Section id="plans" title="Plans & documents">
            <div className="grid gap-2 sm:grid-cols-3">
              <Document label="Brochure" url={profile.brochureUrl} />
              <Document label="Cost sheet" url={profile.costSheetUrl} />
              <Document label="Master plan" url={profile.masterPlanUrl} />
            </div>
            {profile.masterPlanUrl && <PlanImage url={profile.masterPlanUrl} alt={`${project.name} master plan`} />}
            <h3 className="mb-2 mt-5 text-sm font-semibold">Floor plans by configuration</h3>
            {plans.size ? [...plans].map(([configuration, entries]) => (
              <details key={configuration} className="border-b border-line py-2 text-sm">
                <summary className="cursor-pointer font-medium">{configuration} <span className="ml-2 font-normal text-muted">{entries.length ? `${entries.length} plans` : MISSING}</span></summary>
                {entries.map((plan) => (
                  <div key={plan.url} className="my-3">
                    <Document label={[configuration, plan.unitSizeSqft && formatArea(plan.unitSizeSqft), plan.facing].filter(Boolean).join(" · ")} url={plan.url} />
                    <PlanImage url={plan.url} alt={`${project.name} ${configuration} floor plan`} />
                  </div>
                ))}
              </details>
            )) : <p className="text-sm text-muted">Floor plans not supplied.</p>}
          </Section>

          <Section id="amenities" title="Amenities & clubhouse">
            <Facts rows={[["Clubhouse size", profile.clubhouseSqft == null ? null : formatArea(profile.clubhouseSqft)]]} />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {[...amenities].map(([category, names]) => <div key={category}><h3 className="mb-2 text-sm font-semibold">{category}</h3><TextList items={names} /></div>)}
            </div>
            {!amenities.size && <p className="text-sm text-muted">Amenities not supplied.</p>}
          </Section>

          <Section id="specifications" title="Specifications">
            <details className="rounded-xl border border-line p-3">
              <summary className="cursor-pointer text-sm font-semibold">Construction and services</summary>
              <div className="mt-3"><Facts rows={SPECIFICATIONS.map(([key, label]) => [label, profile.specifications?.[key]])} /></div>
            </details>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div><h3 className="mb-2 text-sm font-semibold">Additional credentials</h3>
                {profile.credentials?.length ? <ul className="space-y-2 text-sm">{profile.credentials.map((item) => <li key={item.name}>{item.url ? <a href={item.url} className="text-accent underline">{item.name}</a> : item.name}{item.reference && ` · ${item.reference}`}</li>)}</ul> : <p className="text-sm text-muted">Credentials such as IGBC certification have not been supplied.</p>}
              </div>
              <div><h3 className="mb-2 text-sm font-semibold">Consultants & partners</h3><TextList items={profile.partners?.map(({ name, role }) => `${role} · ${name}`)} /></div>
            </div>
          </Section>

          <Section id="location" title={locality ? `Location · ${locality.name}` : "Location"}>
            {locality && <><p className="text-sm leading-relaxed text-muted">{locality.summary}</p><Link href={`/locality/${locality.slug}`} className="mt-2 inline-block text-sm font-semibold text-accent hover:underline">Explore {locality.name}</Link></>}
            <h3 className="mb-2 mt-5 text-sm font-semibold">Nearby places</h3>
            <Facts rows={nearby.map((place) => [`${place.name} · ${POI_CATEGORY_LABEL[place.category]}`, formatDistance(place.distanceKm)])} />
            {nearby.length > 0 && <p className="mt-2 text-xs text-muted">Straight-line distances from the project.</p>}
          </Section>

          <Section id="builder" title="Builder profile">
            {developer ? <><h3 className="text-lg font-semibold">{developer.name}</h3><p className="mb-3 text-sm text-muted">Established {developer.establishedYear} · {formatCount(developer.projectsDelivered)} projects delivered</p><p className="text-sm leading-relaxed text-muted">{developer.about}</p></> : <p className="text-sm text-muted">{MISSING}</p>}
          </Section>

          <ProjectGroup title="Nearby projects" projects={related} />
          <ProjectGroup title="Similar projects" projects={similar} />
          <ProjectGroup title="Other projects by this builder" projects={otherProjects} />

          <Section id="reviews" title="Ratings & reviews">
            {rating == null ? <p className="text-sm text-muted">No ratings or reviews yet.</p> : (
              <><p className="mb-3 font-semibold">{rating.toFixed(1)} / 5 · {formatCount(reviews.length)} reviews</p>
                <ul className="divide-y divide-line">{reviews.map((review) => <li key={review.id} className="py-3 text-sm"><strong>{review.author}</strong> · {review.rating} / 5<p className="mt-1 text-muted">{review.text}</p></li>)}</ul>
              </>
            )}
          </Section>

          <Section title="Pros & cons">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><h3 className="mb-2 text-sm font-semibold">Pros</h3><TextList items={profile.pros} empty="No sourced assessment supplied." /></div>
              <div><h3 className="mb-2 text-sm font-semibold">Cons</h3><TextList items={profile.cons} empty="No sourced assessment supplied." /></div>
            </div>
          </Section>

          <Section id="faqs" title="FAQs">
            {faqs.map(({ question, answer }) => <details key={question} className="border-b border-line py-3 text-sm"><summary className="cursor-pointer font-semibold">{question}</summary><p className="mt-2 text-muted">{answer}</p></details>)}
          </Section>
        </div>

        <aside className="h-fit rounded-[var(--r-lg)] border border-line bg-raised p-5 shadow-e1 lg:sticky lg:top-[88px]">
          <p className="text-xs text-muted">Listed price range</p>
          <p className="mt-1 text-xl font-semibold">{formatPrice(project.priceMin)} – {formatPrice(project.priceMax)}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">{project.configurations.map((configuration) => <Tag key={configuration}>{configuration}</Tag>)}</div>
          <p className="mt-4 border-t border-line pt-3 text-sm text-muted">Listed possession · {project.possessionDate || MISSING}</p>
          <a href="#inventory" className="mt-4 flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink">Browse properties <ArrowUpRight size={15} /></a>
        </aside>
      </div>
    </main>
  );
}

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return <section id={id} className="scroll-mt-3 rounded-[var(--r-lg)] border border-line bg-raised p-4 sm:p-6">
    <h2 className="mb-4 font-[family-name:var(--font-editorial)] text-[clamp(28px,4vw,38px)] leading-tight tracking-tight">{title}</h2>
    {children}
  </section>;
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return <dl className="grid gap-x-5 sm:grid-cols-2">
    {rows.map(([label, value], index) => <div key={`${label}-${index}`} className="flex justify-between gap-3 border-b border-line py-2.5 text-sm">
      <dt className="text-muted">{label}</dt><dd className="text-right font-medium">{value || value === 0 ? value : MISSING}</dd>
    </div>)}
  </dl>;
}

function TextList({ items, empty = MISSING }: { items?: string[]; empty?: string }) {
  return items?.length ? <ul className="list-disc space-y-1 pl-4 text-sm text-muted">{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p className="text-sm text-muted">{empty}</p>;
}

function Document({ label, url }: { label: string; url?: string }) {
  const className = "flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5 text-sm";
  return url
    ? <a href={url} className={`${className} font-semibold text-accent hover:bg-accent-wash`}>{label}<ArrowUpRight size={15} aria-hidden="true" /></a>
    : <div className={className}><span>{label}</span><span className="text-xs text-muted">{MISSING}</span></div>;
}

function PlanImage({ url, alt }: { url: string; alt: string }) {
  if (!/\.(avif|gif|jpe?g|png|svg|webp)(?:[?#]|$)/i.test(url)) return null;
  return <Img src={url} alt={alt} className="mt-2 aspect-[4/3] w-full rounded-xl [&_img]:object-contain" sizes="720px" />;
}

function ProjectGroup({ title, projects }: { title: string; projects: Project[] }) {
  return <Section title={title}>
    {projects.length ? <ul className="grid gap-4 sm:grid-cols-2">{projects.map((project) => (
      <li key={project.id}><ProjectCard project={project} developerName={getDeveloper(project.developerId)?.name ?? "Builder not supplied"} localityName={getLocality(project.localityId)?.name ?? "Hyderabad"} /></li>
    ))}</ul> : <p className="text-sm text-muted">No projects to show.</p>}
  </Section>;
}
