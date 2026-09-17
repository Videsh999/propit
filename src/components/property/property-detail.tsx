"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  BedDouble, Bath, Car, Compass, Building2, Calendar, Layers3, Heart, Scale, Share2, Sparkles, ChevronRight,
} from "lucide-react";
import { Img } from "@/components/ui/img";
import { QualityBadge, Tag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PropitMap } from "@/components/map/propit-map";
import { useDiscovery } from "@/store/discovery";
import { POI_CATEGORY_LABEL } from "@/lib/data/pois";
import { AMENITY_BY_SLUG } from "@/lib/data/developers";
import {
  calcEmi, formatArea, formatPrice, formatPriceSqft, formatRent, furnishingLabel,
  possessionLabel, propertyTypeLabel,
} from "@/lib/format";
import type { Developer, Locality, NearbyPlace, PoiCategory, Project, Property } from "@/types";
import { cn } from "@/lib/utils";

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
  const { toggleSaved, savedIds, toggleCompare, compareIds, pushRecent, setAssistantOpen, anchors } =
    useDiscovery();
  const [gallery, setGallery] = useState(0);
  const isSaved = savedIds.includes(property.id);
  const inCompare = compareIds.includes(property.id);

  useEffect(() => {
    pushRecent(property.id);
  }, [property.id, pushRecent]);

  const price =
    property.listingType === "rent" && property.rentMonthly
      ? formatRent(property.rentMonthly)
      : formatPrice(property.price);

  const mapLocalities = useMemo(
    () => [{
      slug: locality.slug, name: locality.name, center: locality.center,
      boundary: locality.boundary, avgPriceSqft: locality.avgPriceSqft,
    }],
    [locality],
  );

  const mapPoints = useMemo(
    () => [{
      id: property.id, lat: property.location.lat, lng: property.location.lng,
      price: property.price, bedrooms: property.bedrooms, type: property.propertyType,
    }],
    [property],
  );

  return (
    <article className="pb-24">
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

          <div className="grid gap-2 md:grid-cols-[2fr_1fr]">
            <motion.div
              key={gallery}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden rounded-[var(--r-lg)]"
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
            <div className="grid grid-cols-4 gap-2 md:grid-cols-2">
              {property.images.slice(0, 4).map((img, i) => (
                <button
                  key={i}
                  onClick={() => setGallery(i)}
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
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <QualityBadge quality={property.dataQuality} />
              <Tag>{propertyTypeLabel(property.propertyType)}</Tag>
              <Tag>{possessionLabel(property.possession)}</Tag>
              {property.reraNumber && <Tag>RERA {property.reraNumber}</Tag>}
            </div>
            <h1 className="display mt-3 text-[36px] leading-tight text-ink md:text-[44px]">
              {property.title}
            </h1>
            <p className="mt-2 text-[15px] text-muted">{property.address}</p>
          </header>

          <dl className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-md)] border border-line bg-[var(--line)] sm:grid-cols-4">
            <Fact icon={BedDouble} label="Bedrooms" value={property.bedrooms || "—"} />
            <Fact icon={Bath} label="Bathrooms" value={property.bathrooms || "—"} />
            <Fact icon={Car} label="Parking" value={property.parking || "—"} />
            <Fact icon={Layers3} label="Built-up" value={formatArea(property.builtupAreaSqft)} />
            <Fact icon={Compass} label="Facing" value={property.facing} />
            <Fact icon={Building2} label="Floor" value={property.floor ? `${property.floor} of ${property.totalFloors}` : "Ground"} />
            <Fact icon={Calendar} label="Available" value={property.availabilityDate} />
            <Fact icon={Layers3} label="Carpet" value={formatArea(property.carpetAreaSqft)} />
          </dl>

          <Section title="About this home">
            <p className="max-w-[68ch] text-[15px] leading-relaxed text-muted">{property.description}</p>
          </Section>

          {property.amenities.length > 0 && (
            <Section title="Amenities">
              <ul className="flex flex-wrap gap-1.5">
                {property.amenities.map((a) => (
                  <li key={a}>
                    <span className="inline-flex h-8 items-center rounded-full border border-line bg-raised px-3 text-[13px] text-muted">
                      {AMENITY_BY_SLUG.get(a as never)?.name ?? a}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Specifications">
            <dl className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              <Spec label="Price per sq.ft" value={formatPriceSqft(property.pricePerSqft)} />
              <Spec label="Maintenance" value={`₹${property.maintenanceMonthly.toLocaleString("en-IN")}/mo`} />
              <Spec label="Furnishing" value={furnishingLabel(property.furnishing)} />
              <Spec label="Age" value={property.ageYears ? `${property.ageYears} years` : "New"} />
              <Spec label="Balconies" value={String(property.balconies)} />
              <Spec label="Total floors" value={String(property.totalFloors)} />
              {property.deposit != null && (
                <Spec label="Deposit" value={formatPrice(property.deposit, { compact: false })} />
              )}
              <Spec label="Listing" value={property.listingType === "rent" ? "For rent" : "For sale"} />
            </dl>
          </Section>

          {/* Map + what's nearby */}
          <Section title="Where it is">
            <div className="overflow-hidden rounded-[var(--r-lg)] border border-line" style={{ height: 340 }}>
              <PropitMap compact points={mapPoints} localities={mapLocalities} />
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
              <Button variant="primary" size="lg" className="w-full">Schedule a visit</Button>
              <Button variant="secondary" size="lg" className="w-full">Request a callback</Button>
              <Button
                variant="ghost"
                size="lg"
                className="w-full gap-1.5"
                onClick={() => setAssistantOpen(true)}
              >
                <Sparkles size={15} strokeWidth={1.75} />
                Ask PropIT about this home
              </Button>
            </div>

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
              <button
                onClick={() => toggleCompare(property.id)}
                className={cn(
                  "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[var(--r-sm)] border text-[13px] transition-colors",
                  inCompare ? "border-[var(--accent-line)] bg-[var(--accent-wash)] text-accent" : "border-line text-muted hover:text-ink",
                )}
              >
                <Scale size={14} strokeWidth={1.75} />
                Compare
              </button>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-11">
      <h2 className="display mb-4 text-[24px] text-ink">{title}</h2>
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
