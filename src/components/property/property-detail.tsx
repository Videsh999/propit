"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useInView, useReducedMotion } from "motion/react";
import {
  BedDouble, Bath, Car, Compass, Building2, Calendar, Heart, Share2, MessageCircle, ChevronRight, ChevronLeft, Check, Play, Pause,
} from "lucide-react";
import { FloorPlan } from "@/components/property/floor-plan";
import { CompareToggle } from "@/components/compare/compare-toggle";
import { Img } from "@/components/ui/img";
import { QualityBadge, Tag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDiscovery } from "@/store/discovery";
import { POI_CATEGORY_LABEL } from "@/lib/data/pois";
import { AMENITIES } from "@/lib/data/developers";
import {
  calcEmi, formatArea, formatPrice, formatPriceSqft, formatRent, furnishingLabel,
  possessionLabel, propertyTypeLabel,
} from "@/lib/format";
import type { Developer, Locality, NearbyPlace, PoiCategory, Project, Property } from "@/types";
import { cn } from "@/lib/utils";

const PropitMap = dynamic(() => import("@/components/map/propit-map").then((module) => module.PropitMap), { ssr: false });
const ScheduleVisit = dynamic(() => import("@/components/home/schedule-visit").then((module) => module.ScheduleVisit));

export function PropertyDetail({
  property, locality, project, developer, similar, nearby,
}: {
  property: Property;
  locality: Locality;
  project: Project | null;
  developer: Developer | null;
  similar: (Property & { localityName: string })[];
  nearby: NearbyPlace[];
}) {
  const { toggleSaved, savedIds, pushRecent, setAssistantOpen, setViewedProperty, anchors } =
    useDiscovery();
  const [gallery, setGallery] = useState(0);
  const [playing, setPlaying] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);
  const galleryVisible = useInView(galleryRef, { amount: 0.2 });
  const reduceMotion = useReducedMotion();
  const imageCount = property.images.length;

  useEffect(() => {
    if (!playing || !galleryVisible || reduceMotion || imageCount < 2) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setGallery((index) => (index + 1) % imageCount);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [playing, galleryVisible, reduceMotion, imageCount]);

  function advancePhoto(direction: number) {
    setPlaying(false);
    setGallery((index) => (index + direction + imageCount) % imageCount);
  }
  const [areaUnit, setAreaUnit] = useState<"ft" | "m">("ft");
  const isPlot = property.propertyType === "plot";
  const isResidential = !isPlot && property.propertyType !== "commercial";
  const [viewing, setViewing] = useState<"site" | "call" | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapVisible = useInView(mapRef, { once: true, margin: "300px" });
  const mapLocalities = useMemo(() => [locality], [locality]);
  const mapPoints = useMemo(() => [{
    id: property.id, ...property.location, price: property.price,
    bedrooms: property.bedrooms, type: property.propertyType,
  }], [property]);
  const isSaved = savedIds.includes(property.id);

  useEffect(() => {
    pushRecent(property.id);
    setViewedProperty({ id: property.id, slug: property.slug, title: property.title });
    return () => setViewedProperty(null);
  }, [property.id, property.slug, property.title, pushRecent, setViewedProperty]);

  const price =
    property.listingType === "rent" && property.rentMonthly
      ? formatRent(property.rentMonthly)
      : formatPrice(property.price);

  const areas = isPlot
    ? [{ label: "Plot area", value: property.builtupAreaSqft, description: "Listed land area" }]
    : [
        { label: "Carpet area", value: property.carpetAreaSqft, description: "Usable floor area" },
        { label: "Built-up area", value: property.builtupAreaSqft, description: "Area including walls" },
        { label: "Super built-up area", value: property.superBuiltupAreaSqft, description: "Built-up area plus a share of common areas" },
      ];
  const amenities = new Map<string, string[]>();
  for (const slug of new Set(property.amenities)) {
    const amenity = AMENITIES.find((entry) => entry.slug === slug);
    const category = amenity?.category ?? "Other amenities";
    amenities.set(category, [...(amenities.get(category) ?? []), amenity?.name ?? slug]);
  }
  const sections = [
    ["overview", "Overview"], ["areas", isPlot ? "Plot area" : "Area & floor plan"],
    ["amenities", "Amenities"], ["costs", "Costs"], ["location", "Location"],
  ];

  return (
    <article className="pb-10 md:pb-14">
      {/* Gallery */}
      <section className="px-5 pt-6 md:px-8">
        <div className="mx-auto max-w-[1440px]">
          <nav className="mb-4 flex items-center gap-1.5 text-[12px] text-faint">
            <Link href="/search" className="hover:text-ink">Search</Link>
            <ChevronRight size={11} />
            <Link href={`/locality/${locality.slug}`} className="hover:text-ink">{locality.name}</Link>
            <ChevronRight size={11} />
            <span className="truncate text-muted">{property.title}</span>
          </nav>

          <div ref={galleryRef} className="grid gap-2 md:grid-cols-[2fr_1fr]">
            <div className="relative">
            <motion.div
              key={gallery}
              initial={gallery === 0 || reduceMotion ? false : { opacity: 0.72, scale: 0.995 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden rounded-[var(--r-lg)] shadow-e2"
            >
              <Img
                src={property.images[gallery]?.url ?? ""}
                alt={`${property.title} — ${property.images[gallery]?.roomTag ?? "photo"}`}
                seed={property.id + gallery}
                className="aspect-[16/10] w-full"
                priority
                sizes="(max-width: 768px) 100vw, 66vw"
              />
            </motion.div>
            {imageCount > 1 && <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 rounded-b-[var(--r-lg)] bg-gradient-to-t from-black/80 to-transparent p-2.5 pt-8 text-white sm:p-4 sm:pt-9">
              <p aria-live={playing ? "off" : "polite"} className="truncate text-xs font-medium">
                {property.images[gallery]?.roomTag} · {gallery + 1} / {imageCount}
              </p>
              <div className="flex shrink-0 gap-1">
                {!reduceMotion && <button type="button" aria-label={playing ? "Pause photo slideshow" : "Play photo slideshow"}
                  className="grid size-9 place-items-center rounded-full bg-black/55 hover:bg-black/80" onClick={() => setPlaying(!playing)}>
                  {playing ? <Pause size={15} /> : <Play size={15} />}
                </button>}
                <button type="button" aria-label="Previous photo" className="grid size-9 place-items-center rounded-full bg-black/55 hover:bg-black/80" onClick={() => advancePhoto(-1)}><ChevronLeft size={17} /></button>
                <button type="button" aria-label="Next photo" className="grid size-9 place-items-center rounded-full bg-black/55 hover:bg-black/80" onClick={() => advancePhoto(1)}><ChevronRight size={17} /></button>
              </div>
            </div>}
            </div>
            <div className="grid grid-cols-4 gap-2 md:grid-cols-2">
              {property.images.slice(0, 4).map((img, i) => (
                <button
                  key={i}
                  onClick={() => { setPlaying(false); setGallery(i); }}
                  aria-pressed={gallery === i}
                  className={cn(
                    "overflow-hidden rounded-[var(--r-md)] transition-all duration-[160ms]",
                    gallery === i ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--paper)]" : "opacity-80 hover:opacity-100",
                  )}
                  aria-label={`View ${img.roomTag}`}
                >
                  <Img src={img.url} alt={img.roomTag} seed={property.id + i} className="aspect-[4/3] w-full" sizes="200px" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-8 grid max-w-[1440px] gap-10 px-5 md:px-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <header id="overview" className="scroll-mt-3">
            <div className="flex flex-wrap items-center gap-2">
              <QualityBadge quality={property.dataQuality} />
              <Tag>{propertyTypeLabel(property.propertyType)}</Tag>
              <Tag>{possessionLabel(property.possession)}</Tag>
              {property.reraNumber && <Tag>RERA {property.reraNumber}</Tag>}
            </div>
            <h1 className="mt-4 font-[family-name:var(--font-editorial)] text-[38px] leading-[1.02] tracking-[-0.045em] text-ink md:text-[54px]">
              {property.title}
            </h1>
            <p className="mt-2 text-[15px] text-muted">{property.address}</p>
          </header>

          <nav aria-label="Property sections" className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-y border-line py-3 text-[13px] font-semibold text-accent">
            {sections.map(([id, label]) => <a key={id} href={`#${id}`} className="hover:underline">{label}</a>)}
          </nav>
          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-md)] border border-line bg-[var(--line)] sm:grid-cols-3">
            {isResidential && <>
              <Fact icon={BedDouble} label="Bedrooms" value={property.bedrooms || "Studio"} />
              <Fact icon={Bath} label="Bathrooms" value={property.bathrooms} />
              <Fact icon={Car} label="Parking spaces" value={property.parking} />
            </>}
            {!isPlot && <Fact icon={Building2} label="Floor" value={property.floor ? `${property.floor} of ${property.totalFloors}` : "Ground"} />}
            <Fact icon={Compass} label="Facing" value={property.facing || "Not listed"} />
            <Fact icon={Calendar} label="Available" value={property.availabilityDate || "Not listed"} />
          </dl>

          <Section title={isPlot ? "About this plot" : "About this property"}>
            <p className="max-w-[68ch] text-[15px] leading-relaxed text-muted">{property.description}</p>
          </Section>

          <Section id="areas" title={isPlot ? "Plot area" : "Area & floor plan"}>
            <div className="rounded-[var(--r-lg)] border border-line bg-raised p-4 sm:p-5">
              <div role="group" aria-label="Area unit" className="mb-4 flex justify-end gap-1 text-[13px]">
                {(["ft", "m"] as const).map((unit) => (
                  <button key={unit} type="button" aria-pressed={unit === areaUnit} onClick={() => setAreaUnit(unit)}
                    className={cn("rounded-full border px-3 py-1.5", unit === areaUnit ? "bg-accent text-[var(--accent-ink)]" : "text-muted")}>
                    {unit === "ft" ? "sq.ft" : "sq.m"}
                  </button>
                ))}
              </div>
              <dl className={cn("grid gap-3", !isPlot && "sm:grid-cols-3")}>
                {areas.map(({ label, value, description }) => (
                  <div key={label} className="rounded-[var(--r-md)] bg-sunk p-3">
                    <dt className="text-[13px] font-semibold text-muted">{label}</dt>
                    <dd className="tnum mt-1 text-[20px] font-semibold text-ink">
                      {value && value > 0 ? areaUnit === "ft" ? formatArea(value) : `${(value * 0.09290304).toLocaleString("en-IN", { maximumFractionDigits: 1 })} sq.m` : "Not listed"}
                    </dd>
                    <dd className="mt-1 text-[12px] text-muted">{description}</dd>
                  </div>
                ))}
              </dl>
              {!isPlot && <FloorPlan url={property.floorPlanUrl} showDemo={isResidential} />}
            </div>
          </Section>

          <Section id="amenities" title="Amenities">
            {amenities.size ? <div className="grid gap-3 sm:grid-cols-2">
              {[...amenities].map(([category, names]) => (
                <div key={category} className="rounded-[var(--r-md)] border border-line bg-raised p-4">
                  <h3 className="mb-2 text-[13px] font-semibold text-ink">{category}</h3>
                  <ul className="space-y-1.5 text-[13px] text-muted">
                    {names.map((name) => <li key={name} className="flex items-center gap-2"><Check size={14} className="shrink-0 text-accent" aria-hidden="true" />{name}</li>)}
                  </ul>
                </div>
              ))}
            </div> : <p className="text-sm text-muted">Amenities not supplied for this listing.</p>}
          </Section>

          <Section id="costs" title="Costs & specifications">
            <dl className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              <Spec label={property.listingType === "rent" ? "Monthly rent" : "Listed price"} value={price} />
              <Spec label="Price per sq.ft" value={formatPriceSqft(property.pricePerSqft)} />
              <Spec label="Maintenance" value={`₹${property.maintenanceMonthly.toLocaleString("en-IN")}/mo`} />
              {!isPlot && <>
              <Spec label="Furnishing" value={furnishingLabel(property.furnishing)} />
              <Spec label="Age" value={property.ageYears ? `${property.ageYears} years` : "New"} />
              <Spec label="Balconies" value={String(property.balconies)} />
              <Spec label="Total floors" value={String(property.totalFloors)} />
              </>}
              <Spec label="Possession" value={possessionLabel(property.possession)} />
              <Spec label="RERA reference" value={property.reraNumber ?? "Not listed"} />
              {property.deposit != null && (
                <Spec label="Deposit" value={formatPrice(property.deposit, { compact: false })} />
              )}
              <Spec label="Listing" value={property.listingType === "rent" ? "For rent" : "For sale"} />
            </dl>
          </Section>

          {/* Map + what's nearby */}
          <Section id="location" title={`Location · ${locality.name}`}>
            <div ref={mapRef} className="grid h-[280px] place-items-center overflow-hidden rounded-[var(--r-lg)] border border-line bg-sunk">
              {mapVisible
                ? <PropitMap compact localityScope={locality} followDiscoveryCamera={false} initialCenter={property.location} points={mapPoints} localities={mapLocalities} />
                : <span className="text-sm text-muted">{property.address}</span>}
            </div>
            <NearbyGrid places={nearby} />
          </Section>

          {anchors.length > 0 && (
            <Section title="From your anchors">
              <ul className="divide-y divide-[var(--line)] border-y border-line">
                {anchors.map((a) => {
                  const dx = haversine(property.location, a.location);
                  return (
                    <li key={a.id} className="flex items-baseline justify-between py-2.5">
                      <span className="text-[14px] text-ink">{a.label}</span>
                      <span className="tnum text-[13px] text-muted">
                        {dx.toFixed(1)} km
                        <span className="ml-1.5 text-faint">
                          · within your {a.maxKm} km limit{dx <= a.maxKm ? "" : " — over"}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {developer && (
            <Section title="Developer">
              <div className="flex items-start gap-4 rounded-[var(--r-md)] border border-line bg-raised p-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[var(--r-sm)] bg-inverse text-[15px] font-semibold text-[var(--ink-inverse)]">
                  {developer.logoMark}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-medium text-ink">{developer.name}</h3>
                  <p className="tnum text-[12px] text-faint">
                    Since {developer.establishedYear} · {developer.projectsDelivered} projects delivered
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">{developer.about}</p>
                </div>
              </div>
            </Section>
          )}

          {similar.length > 0 && (
            <Section title="Similar homes nearby">
              <div className="grid gap-4 sm:grid-cols-2">
                {similar.map((s) => (
                  <Link
                    key={s.id}
                    href={`/property/${s.slug}`}
                    className="group overflow-hidden rounded-[var(--r-md)] border border-line bg-raised transition-shadow hover:shadow-[var(--e2)]"
                  >
                    <Img src={s.images[0]?.url ?? ""} alt={s.title} seed={s.id} className="aspect-[16/10] w-full" sizes="400px" />
                    <div className="p-3.5">
                      <h4 className="truncate text-[14px] font-medium text-ink">{s.title}</h4>
                      <p className="truncate text-[12px] text-faint">{s.localityName}</p>
                      <p className="tnum mt-1.5 text-[15px] font-semibold text-ink">{formatPrice(s.price)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* ---- Sticky price rail ---- */}
        <aside className="lg:sticky lg:top-[92px] lg:h-fit">
          <div className="rounded-[var(--r-lg)] border border-line bg-raised p-5 shadow-[var(--e1)]">
            <div className="flex items-baseline gap-2">
              <span className="tnum text-[30px] font-semibold tracking-tight text-ink">{price}</span>
            </div>
            <p className="tnum mt-1 text-[13px] text-muted">
              {formatPriceSqft(property.pricePerSqft)} · {formatArea(property.builtupAreaSqft)}
            </p>

            {property.listingType === "buy" && <EmiBlock price={property.price} />}

            <div className="mt-5 space-y-2">
              <Button variant="primary" size="lg" className="w-full" aria-expanded={viewing === "site"} onClick={() => setViewing(viewing === "site" ? null : "site")}>Schedule a visit</Button>
              <Button variant="secondary" size="lg" className="w-full" aria-expanded={viewing === "call"} onClick={() => setViewing(viewing === "call" ? null : "call")}>Request a callback</Button>
              <Button
                variant="ghost"
                size="lg"
                className="w-full gap-1.5"
                onClick={() => setAssistantOpen(true)}
              >
                <MessageCircle size={15} strokeWidth={1.75} />
                Ask PropIT about this home
              </Button>
            </div>

            {viewing && <ScheduleVisit key={viewing} propertySlug={property.slug} initialMode={viewing} />}
            <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
              <button
                onClick={() => toggleSaved(property.id)}
                className={cn(
                  "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[var(--r-sm)] border text-[13px] transition-colors",
                  isSaved ? "border-[var(--accent-line)] bg-[var(--accent-wash)] text-accent" : "border-line text-muted hover:text-ink",
                )}
              >
                <Heart size={14} strokeWidth={1.75} fill={isSaved ? "currentColor" : "none"} />
                {isSaved ? "Saved" : "Save"}
              </button>
              <CompareToggle id={property.id} className="h-9 flex-1" />
              <button
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.clipboard) {
                    void navigator.clipboard.writeText(window.location.href);
                  }
                }}
                className="grid h-9 w-9 place-items-center rounded-[var(--r-sm)] border border-line text-muted transition-colors hover:text-ink"
                aria-label="Copy link"
              >
                <Share2 size={14} strokeWidth={1.75} />
              </button>
            </div>

            {project && (
              <Link
                href={`/project/${project.slug}`}
                className="mt-4 flex items-center gap-3 rounded-[var(--r-md)] border border-line p-3 transition-colors hover:bg-sunk"
              >
                <Img src={project.heroImage} alt={project.name} seed={project.id} className="h-11 w-14 shrink-0 rounded-[var(--r-sm)]" sizes="60px" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{project.name}</span>
                  <span className="block text-[11px] text-faint">View the project</span>
                </span>
                <ChevronRight size={14} className="shrink-0 text-faint" />
              </Link>
            )}
          </div>
        </aside>
      </div>
    </article>
  );
}

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-9 scroll-mt-3">
      <h2 className="mb-4 font-[family-name:var(--font-editorial)] text-[30px] leading-tight tracking-[-0.035em] text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof BedDouble; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-paper px-4 py-3.5">
      <dt className="flex items-center gap-1.5 text-[11px] text-faint">
        <Icon size={12} strokeWidth={1.75} />
        {label}
      </dt>
      <dd className="tnum mt-1 text-[15px] font-medium text-ink">{value}</dd>
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

function EmiBlock({ price }: { price: number }) {
  const [down, setDown] = useState(20);
  const [years, setYears] = useState(20);
  const rate = 8.6;
  const principal = price * (1 - down / 100);
  const emi = calcEmi(principal, rate, years);

  return (
    <div className="mt-4 rounded-[var(--r-md)] border border-line bg-sunk p-3.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] text-muted">Estimated EMI</span>
        <span className="tnum text-[17px] font-semibold text-ink">
          ₹{Math.round(emi).toLocaleString("en-IN")}<span className="text-[12px] font-normal text-faint">/mo</span>
        </span>
      </div>
      <div className="mt-3 space-y-2.5">
        <label className="block">
          <span className="tnum flex items-baseline justify-between text-[11px] text-faint">
            <span>Down payment</span>
            <span>{down}% · {formatPrice(price * (down / 100))}</span>
          </span>
          <input
            type="range" min={10} max={60} step={5} value={down}
            onChange={(e) => setDown(Number(e.target.value))}
            className="mt-1 h-1 w-full cursor-pointer appearance-none rounded-full bg-[var(--line-strong)] accent-[var(--accent)]"
          />
        </label>
        <label className="block">
          <span className="tnum flex items-baseline justify-between text-[11px] text-faint">
            <span>Tenure</span>
            <span>{years} years at {rate}%</span>
          </span>
          <input
            type="range" min={5} max={30} step={1} value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            className="mt-1 h-1 w-full cursor-pointer appearance-none rounded-full bg-[var(--line-strong)] accent-[var(--accent)]"
          />
        </label>
      </div>
      <p className="mt-2.5 text-[10px] leading-relaxed text-faint">
        Illustrative only, at an assumed {rate}% rate. Not an offer of credit and not financial
        advice — your actual rate and eligibility depend on your lender.
      </p>
    </div>
  );
}

function NearbyGrid({ places }: { places: NearbyPlace[] }) {
  if (!places.length) return null;
  const groups = new Map<PoiCategory, NearbyPlace[]>();
  for (const p of places) {
    const arr = groups.get(p.category);
    if (arr) arr.push(p);
    else groups.set(p.category, [p]);
  }
  return (
    <div className="mt-5">
      <h3 className="eyebrow mb-3">What&apos;s nearby</h3>
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...groups.entries()].map(([cat, items]) => (
          <div key={cat}>
            <div className="mb-1.5 text-[12px] font-medium text-ink">{POI_CATEGORY_LABEL[cat]}</div>
            <ul className="space-y-1">
              {items.slice(0, 3).map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate text-muted">{p.name.split(",")[0]}</span>
                  <span className="tnum shrink-0 text-faint">
                    {p.distanceKm < 1 ? `${Math.round(p.distanceKm * 1000)} m` : `${p.distanceKm} km`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-faint">
        Distances are straight-line. Travel times shown elsewhere are estimated until routing is
        connected.
      </p>
    </div>
  );
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371.0088;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
