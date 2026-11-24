import { prepareStore } from "@/lib/data/store";
import { isProductionDeployment } from "@/lib/deployment";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, BedDouble, Building2, Calendar, ChartNoAxesCombined, ChevronRight, House, LandPlot, Layers, LayoutGrid, MapPin, MessageCircle, Ruler } from "lucide-react";
import {
  allProjects, getProjectBySlug, getDeveloper, getLocality, getProjectProperties, nearbyPlaces,
} from "@/lib/data/repository";
import { haversineKm } from "@/lib/geo/distance";
import { configurationLabel } from "@/lib/data/project-presentation";
import { Img } from "@/components/ui/img";
import { Tag } from "@/components/ui/badge";
import { ProjectGallery } from "@/components/project/project-gallery";
import { ProjectInsights } from "@/components/project/project-insights";
import { ProjectMap } from "@/components/project/project-map";
import { ProjectAmenities } from "@/components/project/project-amenities";
import { ProjectInventory } from "@/components/project/project-inventory";
import { ProjectLocation } from "@/components/project/project-location";
import { DetailActions } from "@/components/property/detail-actions";
import { POI_CATEGORY_SINGULAR } from "@/lib/data/pois";
import { formatArea, formatCount, formatPrice, projectStatusLabel, propertyTypeLabel } from "@/lib/format";
import type { Project, ProjectSpecification } from "@/types";

const SECTIONS = [
  ["overview", "Overview"], ["amenities", "Amenities"], ["insights", "Price insights"],
  ["inventory", "Available homes"], ["plans", "Plans & documents"], ["location", "Location"],
  ["details", "Project details"], ["builder", "Builder"], ["reviews", "Community"], ["faqs", "FAQs"],
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
  await prepareStore();
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
  await prepareStore();
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();

  const profile = project.profile ?? {};
  const locality = getLocality(project.localityId);
  const developer = getDeveloper(project.developerId);
  const units = getProjectProperties(project.id);
  const listedHomes = units.filter((unit) => unit.propertyType !== "plot" && unit.propertyType !== "commercial");
  const configurations = [...new Set([...project.configurations, ...listedHomes.map(configurationLabel)])].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const sizes = listedHomes.map((unit) => unit.builtupAreaSqft).filter((size) => size > 0);
  const range = profile.unitSizeRangeSqft ?? (sizes.length ? [Math.min(...sizes), Math.max(...sizes)] : null);
  const sizeRange = range ? (range[0] === range[1] ? formatArea(range[0]) : `${formatCount(range[0])}–${formatArea(range[1])}`) : null;
  const nearby = nearbyPlaces(project.location, null, 12, 5, { verifiedOnly: true }).map(
    ({ id, name, category, location, distanceKm, minutes }) => ({
      id, name, category, location, distanceKm, minutes, kind: POI_CATEGORY_SINGULAR[category],
    }),
  );
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
  const plans = new Map<string, NonNullable<typeof profile.floorPlans>>();
  for (const configuration of configurations) plans.set(configuration, []);
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

  const listings = units.map(({ id, slug, title, listingType, propertyType, price, rentMonthly, bedrooms, builtupAreaSqft, images }) => ({ id, slug, title, listingType, propertyType, price, rentMonthly, bedrooms, builtupAreaSqft, image: images[0]?.url }));
  const saleCount = listings.filter(listing => listing.listingType === "buy").length;
  const rentCount = listings.filter(listing => listing.listingType === "rent").length;
  const heroFacts = [
    { label: "Land extent", value: `${project.landAreaAcres} acres`, icon: LandPlot },
    { label: "Total units", value: formatCount(project.unitsTotal), icon: Building2 },
    { label: "Towers & floors", value: `${project.towers} × ${project.floors} floors`, icon: Layers },
    { label: profile.unitSizeRangeSqft ? "Unit sizes" : "Built-up sizes", value: sizeRange ?? MISSING, icon: Ruler },
    { label: "Configurations", value: configurations.join(", ") || MISSING, icon: BedDouble },
    { label: profile.type ? "Project type" : "Listing types", value: profile.type ?? ([...new Set(units.map(unit => propertyTypeLabel(unit.propertyType)))].join(", ") || MISSING), icon: House },
  ];

  return (
    <main className="mx-auto max-w-[1440px] px-4 pb-12 pt-5 sm:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <nav aria-label="Project breadcrumb" className="flex min-w-0 items-center gap-2 text-[14px] text-muted">
        <Link href="/projects" className="shrink-0 hover:text-accent">Projects</Link><ChevronRight size={14} className="shrink-0" />
        {locality && <><Link href={`/locality/${locality.slug}`} className="shrink-0 hover:text-accent">{locality.name}</Link><ChevronRight size={14} className="shrink-0" /></>}
        <span className="truncate font-medium text-ink">{project.name}</span>
      </nav>
      <DetailActions kind="project" id={project.id} slug={project.slug} title={project.name} />
      </div>

      <div className="grid items-start gap-7 lg:grid-cols-2 lg:gap-9">
        <section id="media" className="min-w-0 scroll-mt-16" aria-label="Project photographs">
          <ProjectGallery key={project.id} name={project.name} images={[project.heroImage, ...project.gallery]} videoUrl={profile.videoUrl} preview={!isProductionDeployment()} />
        </section>
        <header className="min-w-0 lg:py-1">
          <div className="flex flex-wrap items-center gap-2"><Tag>{projectStatusLabel(project.status)}</Tag>{profile.type && <Tag>{profile.type}</Tag>}{profile.category && <Tag>{profile.category}</Tag>}</div>
          <h1 className="mt-4 text-[clamp(36px,4.3vw,60px)] font-semibold leading-[1.06] tracking-[-.045em]">{project.name}</h1>
          <p className="mt-3 flex items-center gap-2 text-[16px] text-muted"><MapPin size={17} className="shrink-0" />{locality ? `${locality.name}, Hyderabad` : "Hyderabad"}</p>
          <p className="mt-2 text-[14px] text-muted">By <Link href="#builder" className="font-semibold text-accent hover:underline">{developer?.name ?? "Builder details not supplied"}</Link></p>

          <dl className="my-6 grid grid-cols-2 gap-x-5 gap-y-5 border-y border-line py-5 sm:grid-cols-3">
            {heroFacts.map(({ label, value, icon: Icon }) => <div key={label} className="flex min-w-0 items-start gap-2.5"><Icon size={21} strokeWidth={1.5} className="mt-0.5 shrink-0 text-accent" /><div className="min-w-0"><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 break-words text-[14px] font-semibold leading-snug">{value}</dd></div></div>)}
          </dl>

          <div className="rounded-2xl border border-line bg-accent-wash p-5">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.1em] text-muted">Listed project range</p><p className="mt-2 text-[clamp(24px,2.7vw,36px)] font-semibold leading-tight tracking-tight">{formatPrice(project.priceMin)} <span className="font-normal text-muted">–</span> {formatPrice(project.priceMax)}</p></div><Link href="#insights" className="flex min-h-11 items-center gap-2 text-[14px] font-semibold text-accent"><ChartNoAxesCombined size={16} />Price insights</Link></div>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-accent/15 pt-3 text-[14px] text-muted"><span>{saleCount} sale listings</span><span>{rentCount} rental listings</span><span className="flex items-center gap-1.5"><Calendar size={14} />Possession · {project.possessionDate || MISSING}</span></div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[{ label: "Available homes", value: `${units.length} listings`, href: "#inventory", icon: House }, { label: "Plans & documents", value: "Explore layouts", href: "#plans", icon: LayoutGrid }, { label: "Location", value: "Map & commute", href: "#location", icon: MapPin }].map(({ label, value, href, icon: Icon }) => <Link key={href} href={href} className="flex min-h-24 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-raised p-2 text-center transition-colors hover:border-accent hover:bg-accent-wash"><Icon size={20} strokeWidth={1.5} className="mb-1 text-accent" /><span className="text-xs font-semibold sm:text-[14px]">{label}</span><span className="text-xs text-muted">{value}</span></Link>)}
          </div>
        </header>
      </div>

      <nav aria-label="Project sections" className="sticky top-[72px] z-20 mb-7 mt-7 flex gap-6 overflow-x-auto whitespace-nowrap border-y border-line bg-paper/95 px-1 py-4 text-[14px] font-semibold text-muted backdrop-blur-xl">
        {SECTIONS.map(([id, label]) => <Link href={`#${id}`} key={id} className="rounded-sm transition-colors hover:text-accent">{label}</Link>)}
      </nav>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Section id="overview" title="About the project">
          <p className="text-[16px] leading-relaxed text-muted">{project.description}</p>
          <h3 className="mb-3 mt-6 text-lg font-semibold">At a glance</h3>
          <Facts rows={[["Towers / floors", `${project.towers} towers · ${project.floors} floors`], ["Density", project.landAreaAcres > 0 ? `${(project.unitsTotal / project.landAreaAcres).toFixed(1)} units / acre` : null], ["FSI", profile.floorSpaceIndex], ["Open area", profile.openAreaPercent == null ? null : `${profile.openAreaPercent}%`]]} />
          {profile.highlights?.length ? <div className="mt-5"><h3 className="mb-2 text-[14px] font-semibold">What makes it stand out</h3><TextList items={profile.highlights} /></div> : null}
          <Link href="#details" className="mt-5 inline-flex min-h-11 items-center text-[14px] font-semibold text-accent hover:underline">All project details</Link>
        </Section>
        <Section id="amenities" title="Amenities & clubhouse">
          <p className="text-[16px] leading-relaxed text-muted">Spaces for your everyday routines and your downtime.</p>
          <ProjectAmenities amenities={project.amenities} compact />
          {profile.clubhouseSqft != null && <p className="mt-4 text-[14px] text-muted">Clubhouse · <strong className="text-ink">{formatArea(profile.clubhouseSqft)}</strong></p>}
          <div className="mt-5 flex flex-wrap gap-2"><Document label="Brochure" url={profile.brochureUrl} /><Link href="#builder" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-paper px-4 text-[14px] font-semibold text-accent"><Building2 size={16} />Meet the builder</Link></div>
        </Section>
      </div>

      <div className="mt-5 space-y-5">
        <Section id="insights" title="Price insights">
          <p className="mb-5 max-w-[68ch] text-[16px] leading-relaxed text-muted">A clearer view of the neighbourhood and the homes currently listed in this project.</p>
          <ProjectInsights key={project.id} locality={locality ? { name: locality.name, priceHistory: locality.priceHistory, dataQuality: locality.dataQuality } : null} listings={listings} />
        </Section>

        <Section id="inventory" title="Available properties">
          <p className="mb-5 text-[16px] text-muted">Find your fit within this community. Explore sale and rental homes by configuration.</p>
          <ProjectInventory key={project.id} listings={listings} />
        </Section>

        <Section id="plans" title="Plans & documents">
          <div className="grid gap-3 sm:grid-cols-3"><Document label="Brochure" url={profile.brochureUrl} /><Document label="Cost sheet" url={profile.costSheetUrl} /><Document label="Master plan" url={profile.masterPlanUrl} /></div>
          {profile.masterPlanUrl && <PlanImage url={profile.masterPlanUrl} alt={`${project.name} master plan`} />}
          <h3 className="mb-2 mt-6 text-lg font-semibold">Floor plans by configuration</h3>
          {plans.size ? [...plans].map(([configuration, entries]) => <details key={configuration} className="border-b border-line py-3 text-[14px]">
            <summary className="min-h-8 cursor-pointer font-semibold">{configuration}<span className="ml-2 font-normal text-muted">{entries.length ? `${entries.length} plans` : MISSING}</span></summary>
            {entries.map(plan => <div key={plan.url} className="my-3"><Document label={[configuration, plan.unitSizeSqft && formatArea(plan.unitSizeSqft), plan.facing].filter(Boolean).join(" · ")} url={plan.url} /><PlanImage url={plan.url} alt={`${project.name} ${configuration} floor plan`} /></div>)}
          </details>) : <p className="text-[14px] text-muted">Floor plans not supplied.</p>}
        </Section>

        <Section id="location" title={locality ? `Life around ${locality.name}` : "Location & connectivity"}>
          {locality && <div className="flex flex-wrap items-start justify-between gap-3"><p className="max-w-[72ch] text-[16px] leading-relaxed text-muted">{locality.summary}</p><Link href={`/locality/${locality.slug}`} className="inline-flex min-h-11 items-center text-[14px] font-semibold text-accent hover:underline">Explore {locality.name}</Link></div>}
          <ProjectMap key={project.id} location={project.location} locality={locality ?? null} project={{ id: project.id, slug: project.slug, name: project.name, lat: project.location.lat, lng: project.location.lng, priceMin: project.priceMin }} points={units.map(unit => ({ id: unit.id, ...unit.location, price: unit.price, bedrooms: unit.bedrooms, type: unit.propertyType }))} />
          <ProjectLocation name={project.name} origin={project.location} places={nearby} />
        </Section>

        <Section id="details" title="The finer details">
          <details className="rounded-xl border border-line px-4 py-3"><summary className="min-h-8 cursor-pointer text-[16px] font-semibold">Project details & RERA</summary><div className="mt-3"><Facts rows={facts} /></div></details>
          <details id="specifications" className="mt-3 scroll-mt-16 rounded-xl border border-line px-4 py-3"><summary className="min-h-8 cursor-pointer text-[16px] font-semibold">Construction & specifications</summary><div className="mt-3"><Facts rows={SPECIFICATIONS.map(([key, label]) => [label, profile.specifications?.[key]])} /></div></details>
          <div className="mt-5 grid gap-5 sm:grid-cols-2"><div><h3 className="mb-2 text-[14px] font-semibold">Credentials & certifications</h3>{profile.credentials?.length ? <ul className="space-y-2 text-[14px]">{profile.credentials.map(item => <li key={item.name}>{item.url ? <a href={item.url} className="text-accent underline">{item.name}</a> : item.name}{item.reference && ` · ${item.reference}`}</li>)}</ul> : <p className="text-[14px] text-muted">Credentials have not been supplied.</p>}</div><div><h3 className="mb-2 text-[14px] font-semibold">Consultants & partners</h3><TextList items={profile.partners?.map(({ name, role }) => `${role} · ${name}`)} /></div></div>
        </Section>

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Section id="builder" title="The people behind the project">
            {developer ? <><div className="mb-4 flex items-center gap-3"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-wash text-[14px] font-semibold text-accent">{developer.logoMark}</span><div><h3 className="text-lg font-semibold">{developer.name}</h3><p className="mt-1 text-[14px] text-muted">Since {developer.establishedYear} · {formatCount(developer.projectsDelivered)} projects delivered</p></div></div><p className="text-[16px] leading-relaxed text-muted">{developer.about}</p></> : <p className="text-[14px] text-muted">{MISSING}</p>}
          </Section>
          <Section id="reviews" title="Community & reviews">
            {rating == null ? <div className="rounded-2xl border border-dashed border-line bg-paper p-6"><MessageCircle size={26} strokeWidth={1.5} className="text-accent" /><p className="mt-3 text-[16px] font-semibold">A fresh perspective starts here.</p><p className="mt-2 text-[14px] leading-relaxed text-muted">No ratings or reviews have been supplied for this project yet.</p></div> : <><p className="mb-3 text-2xl font-semibold">{rating.toFixed(1)} <span className="text-[14px] font-normal text-muted">/ 5 · {formatCount(reviews.length)} reviews</span></p><ul className="divide-y divide-line">{reviews.map(review => <li key={review.id} className="py-3 text-[14px]"><strong>{review.author}</strong> · {review.rating} / 5<p className="mt-2 leading-relaxed text-muted">{review.text}</p></li>)}</ul></>}
          </Section>
        </div>

        <Section id="related" title="Keep exploring">
          <ProjectGroup title="Nearby projects" projects={related} /><ProjectGroup title="Similar projects" projects={similar} /><ProjectGroup title="More from this builder" projects={otherProjects} />
        </Section>

        <Section title="Pros & cons">
          <div className="grid gap-5 sm:grid-cols-2"><div><h3 className="mb-2 text-[14px] font-semibold">Pros</h3><TextList items={profile.pros} empty="No sourced assessment supplied." /></div><div><h3 className="mb-2 text-[14px] font-semibold">Cons</h3><TextList items={profile.cons} empty="No sourced assessment supplied." /></div></div>
        </Section>
        <Section id="faqs" title="A few useful answers">
          {faqs.map(({ question, answer }) => <details key={question} className="border-b border-line py-3 text-[16px]"><summary className="min-h-8 cursor-pointer font-semibold">{question}</summary><p className="mt-2 leading-relaxed text-muted">{answer}</p></details>)}
        </Section>
      </div>
    </main>
  );
}

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return <section id={id} className="min-w-0 scroll-mt-16 rounded-[24px] border border-line bg-raised p-5 sm:p-7">
    <h2 className="mb-5 text-[clamp(26px,3vw,34px)] font-semibold leading-tight tracking-[-.035em]">{title}</h2>
    {children}
  </section>;
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return <dl className="grid gap-x-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
    {rows.map(([label, value], index) => <div key={`${label}-${index}`} className="flex justify-between gap-3 border-b border-line py-2.5 text-[14px]">
      <dt className="text-muted">{label}</dt><dd className="text-right font-medium">{value || value === 0 ? value : MISSING}</dd>
    </div>)}
  </dl>;
}

function TextList({ items, empty = MISSING }: { items?: string[]; empty?: string }) {
  return items?.length ? <ul className="list-disc space-y-1 pl-4 text-[14px] text-muted">{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p className="text-[14px] text-muted">{empty}</p>;
}

function Document({ label, url }: { label: string; url?: string }) {
  const className = "flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5 text-[14px]";
  return url
    ? <a href={url} className={`${className} font-semibold text-accent hover:bg-accent-wash`}>{label}<FileText size={15} aria-hidden="true" /></a>
    : <div className={className}><span>{label}</span><span className="text-xs text-muted">{MISSING}</span></div>;
}

function PlanImage({ url, alt }: { url: string; alt: string }) {
  if (!/\.(avif|gif|jpe?g|png|svg|webp)(?:[?#]|$)/i.test(url)) return null;
  return <Img src={url} alt={alt} className="mt-2 aspect-[4/3] w-full rounded-xl [&_img]:object-contain" sizes="720px" />;
}

function ProjectGroup({ title, projects }: { title: string; projects: Project[] }) {
  if (!projects.length) return null;
  return <div className="mt-5 first:mt-0"><h3 className="mb-3 text-[14px] font-semibold text-muted">{title}</h3><ul className="flex flex-wrap gap-2">
    {projects.map(project => <li key={project.id}><Link href={`/project/${project.slug}`} className="inline-flex min-h-11 items-center rounded-full border border-line bg-paper px-4 text-[14px] font-medium transition-colors hover:border-accent hover:text-accent">{project.name}</Link></li>)}
  </ul></div>;
}
