"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { ArrowUpRight, BedDouble, ChevronDown, LocateFixed, SlidersHorizontal } from "lucide-react";
import { AnimatePresence } from "motion/react";
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
import { ORR_BBOX } from "@/lib/map/viewport";
import type { MapProject } from "@/components/map/propit-map";
import { usePoiViewport } from "@/lib/hooks/use-poi-viewport";
import { useProperties, useZone, type PropertiesResponse } from "@/lib/hooks/use-properties";
import { useSelectedProperty } from "@/lib/hooks/use-selected-property";
import { filtersToParams, useDiscovery } from "@/store/discovery";
import type { ListingType, Locality, ScoredProperty } from "@/types";
import styles from "./hero.module.css";

const PropitMap = dynamic(() => import("@/components/map/propit-map").then((module) => module.PropitMap), {
  ssr: false,
  loading: () => <div className={styles.mapPlaceholder} role="status">Loading Hyderabad map…</div>,
});

type LocalityLite = Pick<Locality, "slug" | "name" | "center" | "boundary" | "avgPriceSqft">;

const BUDGETS = {
  buy: [[1e7, "Under ₹1 Cr"], [2e7, "Under ₹2 Cr"], [3e7, "Under ₹3 Cr"], [5e7, "Under ₹5 Cr"]],
  rent: [[25000, "Under ₹25k / mo"], [50000, "Under ₹50k / mo"], [100000, "Under ₹1 lakh / mo"]],
} as const;
const POPULAR = ["kokapet", "gachibowli", "financial-district", "tellapur"];
const EMPTY_POINTS: PropertiesResponse["points"] = [];

export function Hero({ localities, mapProjects, initialResults, prime, projects }: {
  localities: LocalityLite[];
  mapProjects: (MapProject & { localityId: string })[];
  initialResults: PropertiesResponse;
  prime: ReactNode;
  projects: ReactNode;
}) {
  const {
    filters, setFilters, resetFilters, anchors, radius, polygon, useBounds, sort,
    setBounds, setUseBounds, selectedLocalitySlug, selectedPropertyId,
    filtersOpen, setFiltersOpen, setRadius, setPolygon, setDrawMode, fitBounds, select,
    setAnchorsOpen, layers,
  } = useDiscovery(useShallow((s) => ({
    filters: s.filters, setFilters: s.setFilters, resetFilters: s.resetFilters,
    anchors: s.anchors, radius: s.radius, polygon: s.polygon, useBounds: s.useBounds, sort: s.sort,
    setBounds: s.setBounds, setUseBounds: s.setUseBounds, selectedLocalitySlug: s.selectedLocalitySlug,
    selectedPropertyId: s.selectedPropertyId, filtersOpen: s.filtersOpen, setFiltersOpen: s.setFiltersOpen,
    setRadius: s.setRadius, setPolygon: s.setPolygon, setDrawMode: s.setDrawMode,
    fitBounds: s.fitBounds, select: s.select, setAnchorsOpen: s.setAnchorsOpen, layers: s.layers,
  })));
  const filterCount = activeFilterCount(filters);
  const isDefault = filters.listingType === "buy" && !filterCount
    && !anchors.length && !radius && !polygon && !useBounds && sort === "relevance";
  const { data, isPlaceholderData, isError, refetch } = useProperties({ limit: 3, initialData: isDefault ? initialResults : undefined });
  const { data: zone } = useZone();
  const { data: pois } = usePoiViewport(Object.entries(layers).some(([name, enabled]) =>
    enabled && !["localities", "projects", "priceHeat"].includes(name)));
  const results = isDefault ? initialResults : data;
  const updating = !isDefault && (!data || isPlaceholderData) && !isError;
  const preview = useSelectedProperty(isPlaceholderData && !isDefault ? undefined : results?.items);
  const searchHref = `/search?${filtersToParams(filters, anchors, radius)}`;
  const popular = localities.filter(({ slug }) => POPULAR.includes(slug));
  const currentLocality = filters.localitySlugs.length === 1 ? filters.localitySlugs[0] : "";

  const focusedLocality = localities.find(({ slug }) => slug === currentLocality);
  const mapLocalities = useMemo(() => focusedLocality ? [focusedLocality] : localities, [focusedLocality, localities]);
  const scopedProjects = useMemo(() => focusedLocality
    ? mapProjects.filter(({ localityId }) => localityId === `loc_${focusedLocality.slug}`)
    : mapProjects, [focusedLocality, mapProjects]);
  const hasMapScope = Boolean(filters.localitySlugs.length || radius || polygon || useBounds);
  const mapCount = updating ? "Updating homes…" : results
    ? `${formatCount(results.total)} ${results.total === 1 ? "home" : "homes"}`
    : isError ? "Homes unavailable" : "Finding homes…";

  function chooseListing(listingType: ListingType) {
    if (listingType === filters.listingType) return;
    select(null);
    setFilters({ listingType, priceMin: null, priceMax: null });
  }

  function chooseLocality(slug: string) {
    select(null);
    setAnchorsOpen(false);
    setRadius(null);
    setPolygon(null);
    setDrawMode("none");
    setUseBounds(false);
    setFilters({ localitySlugs: slug ? [slug] : [] });
    if (!slug && !focusedLocality) fitBounds(ORR_BBOX);
  }

  return (
    <div className={styles.page}>
      <section id="home-map" className={styles.map} aria-labelledby="home-title">
        <div className={styles.mapCanvas}>
          <PropitMap
            localityScope={focusedLocality}
            scrollZoom={false}
            cooperativeGestures
            points={updating ? EMPTY_POINTS : results?.points ?? EMPTY_POINTS}
            contextPoints={updating ? undefined : results?.contextPoints}
            localityCounts={updating ? undefined : results?.localityCounts}
            projects={scopedProjects}
            localities={mapLocalities}
            pois={pois.places}
            zone={zone?.zone}
            onBoundsChange={setBounds}
          />
        </div>
        <div className={styles.mapControls}>
          <div className={styles.searchPanel}>
            <div className={styles.searchHeading}>
              <h1 id="home-title">Hyderabad property map</h1>
              <p aria-live="polite">{mapCount}{focusedLocality ? ` · ${focusedLocality.name}` : ""}</p>
            </div>
            <div className={styles.listingTabs} aria-label="Listing type">
              {(["buy", "rent"] as const).map((type) => (
                <button key={type} onClick={() => chooseListing(type)} aria-pressed={filters.listingType === type}>
                  {type === "buy" ? "Buy" : "Rent"}
                </button>
              ))}
              <Link href="/projects">Projects <ArrowUpRight size={13} /></Link>
            </div>
            <div className={styles.searchRow}>
              <SearchInput className={styles.searchInput} size="md" placeholder="Search a locality or landmark" stayOnMap />
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
          <MapToolbar localities={localities} />
        </div>
        <div className={styles.mapFooter}>
          <div className={styles.localities} role="group" aria-label="Popular localities">
            <button aria-pressed={!hasMapScope} onClick={() => chooseLocality("")}>
              <LocateFixed size={14} aria-hidden="true" /> Hyderabad
            </button>
            {popular.map((locality) => (
              <button key={locality.slug} aria-pressed={currentLocality === locality.slug} onClick={() => chooseLocality(locality.slug)}>
                {locality.name}
              </button>
            ))}
          </div>
          {layers.priceHeat && layers.localities && (
            <div className={styles.legend}>
              <span>Price per sq.ft</span>
              <span aria-hidden="true" className={styles.legendScale} />
              <span>Lower to higher</span>
            </div>
          )}
        </div>
        <AnimatePresence>{selectedLocalitySlug && <LocalityPanel />}</AnimatePresence>
        <AnimatePresence><AnchorsPanel /></AnimatePresence>
        <AnimatePresence>
          {selectedPropertyId && (
            <PropertyPreview key={selectedPropertyId} error={preview.isError} onRetry={() => void preview.refetch()}
              className="bottom-[76px] max-h-[min(480px,calc(100%-88px))] max-sm:fixed max-sm:max-h-[calc(100dvh-156px)] [@media(max-height:570px)]:fixed [@media(max-height:570px)]:max-h-[calc(100dvh-156px)]" />
          )}
        </AnimatePresence>
        <a className={styles.browseLink} href="#explore">Browse homes <ChevronDown size={15} aria-hidden="true" /></a>
      </section>
      <FilterBar hideInline />

      <div className={styles.explore}>
        <section id="explore" aria-labelledby="explore-title">
          <div className={styles.sectionHeader}>
            <h2 id="explore-title">{filters.listingType === "buy" ? "Homes for sale" : "Homes for rent"}</h2>
            <Link href={searchHref} className={styles.textLink}>More search options <ArrowUpRight size={16} /></Link>
          </div>
          <div className={styles.results} aria-busy={updating}>
            {isError ? (
              <div className={styles.empty}>Couldn’t refresh homes. <button onClick={() => refetch()}>Try again</button></div>
            ) : results?.items.length === 0 ? (
              <div className={styles.empty}>No homes match this search. <button onClick={() => { resetFilters(); chooseLocality(""); }}>Clear filters</button></div>
            ) : results?.items.map((property) => (
              <HomeCard key={property.id} property={property} />
            ))}
          </div>
        </section>
        {prime}
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
