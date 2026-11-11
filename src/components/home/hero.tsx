"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRef, type ReactNode } from "react";
import { ArrowUpRight, BedDouble, ChevronDown, MapPin, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, useInView } from "motion/react";
import { AnchorsPanel } from "@/components/anchors/anchors-panel";
import { FilterBar } from "@/components/filters/filter-bar";
import { LocalityPanel } from "@/components/locality/locality-panel";
import { MapToolbar } from "@/components/map/map-toolbar";
import { PropertyPreview } from "@/components/property/property-preview";
import { SearchInput } from "@/components/search/search-input";
import { CompareToggle } from "@/components/compare/compare-toggle";
import { Img } from "@/components/ui/img";
import { activeFilterCount } from "@/lib/data/filters";
import { formatArea, formatCount, formatPrice, formatRent } from "@/lib/format";
import { usePoiViewport } from "@/lib/hooks/use-poi-viewport";
import { useProperties, useZone, type PropertiesResponse } from "@/lib/hooks/use-properties";
import { useSelectedProperty } from "@/lib/hooks/use-selected-property";
import { filtersToParams, useDiscovery } from "@/store/discovery";
import type { ListingType, Locality, ScoredProperty } from "@/types";
import styles from "./hero.module.css";

const PropitMap = dynamic(() => import("@/components/map/propit-map").then((module) => module.PropitMap), {
  ssr: false,
  loading: () => <div className={styles.mapPlaceholder}>Loading map…</div>,
});

type LocalityLite = Pick<Locality, "slug" | "name" | "center" | "boundary" | "avgPriceSqft">;

const BUDGETS = {
  buy: [[1e7, "Under ₹1 Cr"], [2e7, "Under ₹2 Cr"], [3e7, "Under ₹3 Cr"], [5e7, "Under ₹5 Cr"]],
  rent: [[25000, "Under ₹25k / mo"], [50000, "Under ₹50k / mo"], [100000, "Under ₹1 lakh / mo"]],
} as const;
const POPULAR = ["kokapet", "gachibowli", "financial-district", "tellapur"];

export function Hero({ localities, initialResults, prime, projects }: {
  localities: LocalityLite[];
  initialResults: PropertiesResponse;
  prime: ReactNode;
  projects: ReactNode;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapVisible = useInView(mapRef, { once: true, margin: "300px" });
  const {
    filters, setFilters, resetFilters, anchors, radius, polygon, useBounds, sort,
    setBounds, setUseBounds, selectedLocalitySlug, previewProperty,
    filtersOpen, setFiltersOpen, setAnchorsOpen, flyTo,
  } = useDiscovery();
  const { data, isPlaceholderData, isError, refetch } = useProperties({ limit: 3 });
  const { data: zone } = useZone();
  const { data: pois } = usePoiViewport(mapVisible);
  useSelectedProperty();

  const filterCount = activeFilterCount(filters);
  const isDefault = filters.listingType === "buy" && !filterCount
    && !anchors.length && !radius && !polygon && !useBounds && sort === "relevance";
  const results = (filters.localitySlugs.length && isPlaceholderData ? undefined : data) ?? (isDefault ? initialResults : undefined);
  const searchHref = `/search?${filtersToParams(filters, anchors, radius)}`;
  const popular = POPULAR.flatMap((slug) => localities.filter((locality) => locality.slug === slug));
  const currentLocality = filters.localitySlugs.length === 1 ? filters.localitySlugs[0] : "";

  const focusedLocality = localities.find(({ slug }) => slug === currentLocality);

  function chooseListing(listingType: ListingType) {
    if (listingType !== filters.listingType) setFilters({ listingType, priceMin: null, priceMax: null });
  }

  function chooseLocality(slug: string) {
    const locality = localities.find((item) => item.slug === slug);
    setUseBounds(false);
    setFilters({ localitySlugs: locality ? [locality.slug] : [] });
    if (locality) flyTo(locality.center, 12.8);
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.heroContent}>
          <div className={styles.location}><MapPin size={15} /> Hyderabad, Telangana</div>
          <h1 id="home-title">Find your place<br />in <em>Hyderabad.</em></h1>
          <p>Homes for sale, rentals and new projects.</p>
        </div>
        <span className={styles.artCredit}>Architectural illustration</span>
      </section>

      <div className={styles.explore}>
        <div className={styles.searchPanel}>
          <div className={styles.listingTabs} aria-label="Listing type">
            {(["buy", "rent"] as const).map((type) => (
              <button key={type} onClick={() => chooseListing(type)} aria-pressed={filters.listingType === type}>
                {type === "buy" ? "Buy" : "Rent"}
              </button>
            ))}
            <Link href="/projects">Projects <ArrowUpRight size={13} /></Link>
          </div>
          <div className={styles.searchRow}>
            <SearchInput className={styles.searchInput} size="md" placeholder="Search a locality, project or landmark" />
            <div className={styles.selectWrap}>
              <select aria-label="Budget" value={filters.priceMin !== null ? "custom" : filters.priceMax ?? ""} onChange={(event) => setFilters({ priceMin: null, priceMax: Number(event.target.value) || null })}>
                <option value="">Any budget</option>
                {BUDGETS[filters.listingType].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                {filters.priceMin !== null && <option value="custom" disabled>Custom budget</option>}
                {filters.priceMax !== null && !BUDGETS[filters.listingType].some(([value]) => value === filters.priceMax) && (
                  <option value={filters.priceMax}>{filters.listingType === "buy" ? `Under ${formatPrice(filters.priceMax)}` : `Under ${formatRent(filters.priceMax)}`}</option>
                )}
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </div>
            <div className={styles.selectWrap}>
              <select aria-label="Bedrooms" value={filters.bedrooms.length > 1 ? "multiple" : filters.bedrooms[0] ?? ""} onChange={(event) => setFilters({ bedrooms: event.target.value ? [Number(event.target.value)] : [] })}>
                <option value="">Any BHK</option>
                {[0, 1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value === 0 ? "Studio" : value === 5 ? "5+ BHK" : `${value} BHK`}</option>)}
                {filters.bedrooms.length > 1 && <option value="multiple" disabled>Multiple BHK</option>}
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </div>
            <button className={styles.filterButton} onClick={() => setFiltersOpen(true)} aria-expanded={filtersOpen} aria-label="Advanced filters">
              <SlidersHorizontal size={16} /> <span className={styles.filterLabel}>Filters</span> {filterCount > 0 && <span className={styles.filterCount}>{filterCount}</span>}
            </button>
          </div>
        </div>
        <FilterBar hideInline />
        {prime}
        <section id="explore" aria-labelledby="explore-title">

          <div className={styles.sectionHeader}>
            <div>
              <h2 id="explore-title">{filters.listingType === "buy" ? "Homes for sale" : "Homes for rent"}</h2>
            </div>
            <Link href={searchHref} className={styles.textLink}>All matching homes <ArrowUpRight size={16} /></Link>
          </div>

          <div className={styles.localities} aria-label="Popular localities">
            <button aria-pressed={!filters.localitySlugs.length} onClick={() => chooseLocality("")}>All Hyderabad</button>
            {popular.map((locality) => (
              <button key={locality.slug} aria-pressed={currentLocality === locality.slug} onClick={() => chooseLocality(locality.slug)}>{locality.name}</button>
            ))}
          </div>

          <div className={styles.workspace}>
            <div className={styles.results}>
              <div className={styles.resultHeader}>
                <p aria-live="polite">{results ? `${formatCount(results.total)} ${results.total === 1 ? "home" : "homes"}` : isError ? "Homes unavailable" : "Finding homes…"}</p>
                <span>Showcase inventory</span>
              </div>
              {isError ? (
                <div className={styles.empty}>Couldn’t refresh homes. <button onClick={() => refetch()}>Try again</button></div>
              ) : results?.items.length === 0 ? (
                <div className={styles.empty}>No homes match this search. <button onClick={() => { resetFilters(); setUseBounds(false); }}>Clear filters</button></div>
              ) : results?.items.map((property) => (
                <HomeCard key={property.id} property={property} />
              ))}
            </div>
            <div ref={mapRef} id="home-map" className={styles.map} aria-label="Interactive map of Hyderabad homes">
              {mapVisible ? <>
              <PropitMap key={focusedLocality?.slug ?? "hyderabad"} localityScope={focusedLocality} scrollZoom={false} points={results?.points ?? []} contextPoints={results?.contextPoints} localityCounts={results?.localityCounts}
                localities={focusedLocality ? [focusedLocality] : localities} pois={pois.places} zone={zone?.zone} onBoundsChange={setBounds} />
              <MapToolbar localities={localities} />
              <button className={styles.mapAnchor} onClick={() => setAnchorsOpen(true)}><MapPin size={14} /> Add a place</button>
              <AnimatePresence>{selectedLocalitySlug && <LocalityPanel />}</AnimatePresence>
              <AnimatePresence><AnchorsPanel /></AnimatePresence>
              <AnimatePresence>{previewProperty && <PropertyPreview />}</AnimatePresence>
              </> : <div className={styles.mapPlaceholder}>Hyderabad property map</div>}
            </div>
          </div>
        </section>
        {projects}
      </div>
    </div>
  );
}

function HomeCard({ property }: { property: ScoredProperty }) {
  const price = property.listingType === "rent" && property.rentMonthly ? formatRent(property.rentMonthly) : formatPrice(property.price);
  return (
    <article className="relative">
      <Link href={`/property/${property.slug}`} className={styles.card}>
        <Img src={property.images[0]?.url ?? ""} alt="" className={styles.cardImage} sizes="150px" />
        <div className={styles.cardBody}>
          <strong>{price}</strong>
          <h3 className={styles.cardTitle}>{property.title}</h3>
          <p className={styles.address}>{property.address}</p>
          <p><BedDouble size={14} /> {property.bedrooms > 0 && `${property.bedrooms} BHK · `}{formatArea(property.builtupAreaSqft)}</p>
        </div>
      </Link>
      <CompareToggle id={property.id} compact className="absolute right-2 top-2" />
    </article>
  );
}
