"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { Bath, BedDouble, ChevronDown, Grid2X2, LocateFixed, MapPin, SlidersHorizontal } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { AnchorsPanel } from "@/components/anchors/anchors-panel";
import { FilterBar } from "@/components/filters/filter-bar";
import { LocalityFilter } from "@/components/filters/locality-filter";
import { LocalityPanel } from "@/components/locality/locality-panel";
import { MapToolbar } from "@/components/map/map-toolbar";
import { PropertyPreview } from "@/components/property/property-preview";
import { SearchInput } from "@/components/search/search-input";
import { CompareToggle } from "@/components/compare/compare-toggle";
import { Img } from "@/components/ui/img";
import { activeFilterCount } from "@/lib/data/filters";
import { formatArea, formatCount, formatPrice, formatRent, possessionLabel, propertyTypeLabel } from "@/lib/format";
import { AMENITIES } from "@/lib/data/developers";
import { ORR_BBOX } from "@/lib/map/viewport";
import type { MapProject } from "@/components/map/propit-map";
import { usePoiViewport } from "@/lib/hooks/use-poi-viewport";
import { useProperties, useZone, type PropertiesResponse } from "@/lib/hooks/use-properties";
import { useSelectedProperty } from "@/lib/hooks/use-selected-property";
import { filtersToParams, useDiscovery } from "@/store/discovery";
import type { ListingType, Locality, PropertyFilters, PropertyType, ScoredProperty } from "@/types";
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
const PROPERTY_TYPES: PropertyType[] = ["apartment", "villa", "independent_house", "penthouse", "plot", "farmhouse", "commercial"];
const SORTS = [["relevance", "Most relevant"], ["fit", "Best fit"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"], ["area_desc", "Largest first"], ["newest", "Newest"]] as const;

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
    setAnchorsOpen, layers, flyTo, setSort,
  } = useDiscovery(useShallow((s) => ({
    filters: s.filters, setFilters: s.setFilters, resetFilters: s.resetFilters,
    anchors: s.anchors, radius: s.radius, polygon: s.polygon, useBounds: s.useBounds, sort: s.sort,
    setBounds: s.setBounds, setUseBounds: s.setUseBounds, selectedLocalitySlug: s.selectedLocalitySlug,
    selectedPropertyId: s.selectedPropertyId, filtersOpen: s.filtersOpen, setFiltersOpen: s.setFiltersOpen,
    setRadius: s.setRadius, setPolygon: s.setPolygon, setDrawMode: s.setDrawMode,
    fitBounds: s.fitBounds, select: s.select, setAnchorsOpen: s.setAnchorsOpen, layers: s.layers, flyTo: s.flyTo, setSort: s.setSort,
  })));
  const [localityReset, setLocalityReset] = useState(0);
  const filterCount = activeFilterCount(filters);
  const isDefault = filters.listingType === "buy" && !filterCount
    && !anchors.length && !radius && !polygon && !useBounds && sort === "relevance";
  const { data, isPlaceholderData, isError, refetch } = useProperties({ limit: 6, initialData: isDefault ? initialResults : undefined });
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
  const sidebarLocalities = useMemo(() => {
    const counts = new Map(results?.localityCounts.map(({ slug, count }) => [slug, count]));
    return localities.map(({ slug, name }) => ({ slug, name, count: updating || filters.localitySlugs.length > 0 ? undefined : counts.get(slug) ?? 0 }));
  }, [localities, results?.localityCounts, updating, filters.localitySlugs.length]);
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

  function resetBrowsing() {
    resetFilters();
    chooseLocality("");
    setSort("relevance");
    setLocalityReset((value) => value + 1);
  }

  return (
    <div className={styles.page}>
      <section id="home-map" className={styles.map} aria-labelledby="home-title">
        <aside className={styles.mapControls} aria-label="Map filters and localities">
          <div className={styles.searchPanel} role="group" aria-label="Map property filters">
            <div className={styles.searchHeading}>
              <span className={styles.mapEyebrow}><MapPin size={14} aria-hidden="true" /> Hyderabad <span>Property atlas</span></span>
              <h1 id="home-title">Find your <br /><span>place.</span></h1>
              <p>A better way to call Hyderabad home.</p>
            </div>
            <div className={styles.listingTabs} aria-label="Listing type">
              {(["buy", "rent"] as const).map((type) => (
                <button key={type} onClick={() => chooseListing(type)} aria-pressed={filters.listingType === type}>
                  {type === "buy" ? "Buy" : "Rent"}
                </button>
              ))}
              <Link href="/projects">Projects</Link>
            </div>
            <div className={styles.searchRow}>
              <SearchInput className={styles.searchInput} size="md" placeholder="Search a locality or landmark" stayOnMap />
              <div className={styles.selectWrap}>
                <select aria-label="Budget" value={filters.priceMin !== null ? "custom" : filters.priceMax ?? ""} onChange={(event) => setFilters({ priceMin: null, priceMax: Number(event.target.value) || null })}>
                  <BudgetOptions filters={filters} />
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </div>
              <div className={styles.selectWrap}>
                <select aria-label="Bedrooms" value={filters.bedrooms.length > 1 ? "multiple" : filters.bedrooms[0] ?? ""} onChange={(event) => setFilters({ bedrooms: event.target.value ? [Number(event.target.value)] : [] })}>
                  <BedroomOptions filters={filters} />
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </div>
              <button className={styles.filterButton} onClick={() => setFiltersOpen(true)} aria-expanded={filtersOpen} aria-label="Advanced filters">
                <SlidersHorizontal size={16} /> <span className={styles.filterLabel}>Filters</span> {filterCount > 0 && <span className={styles.filterCount}>{filterCount}</span>}
              </button>
            </div>
          </div>
          <div className={styles.sidebarScroll}>
            <div className={styles.sidebarLocalities}>
              <LocalityFilter key={localityReset} items={sidebarLocalities} value={currentLocality || (filters.localitySlugs.length ? "multiple" : "")} onChange={chooseLocality} />
            </div>
            <div className={styles.railResults}>
              <div className={styles.railResultHeader}>
                <p aria-live="polite">{mapCount}<span>{focusedLocality?.name ?? "Across Hyderabad"}</span></p>
                <Link href={searchHref}>View all</Link>
              </div>
              {!isError && results?.items.slice(0, 2).map((property) => (
                <button key={property.id} type="button" className={styles.railHome}
                  aria-pressed={selectedPropertyId === property.id} aria-label={`Show ${property.title}, ${property.address}, on map`}
                  onClick={() => { select(property.id, property); flyTo(property.location, 15.2); }}>
                  <Img src={property.images[0]?.url ?? ""} alt="" className={styles.railImage} sizes="72px" />
                  <span className={styles.railHomeInfo}>
                    <strong>{property.listingType === "rent" && property.rentMonthly ? formatRent(property.rentMonthly) : formatPrice(property.price)}</strong>
                    <span>{property.title}</span>
                    <small>{property.address.split(",").at(-2)?.trim() ?? "Hyderabad"} · {formatArea(property.builtupAreaSqft)}</small>
                  </span>
                  <MapPin size={15} aria-hidden="true" className={styles.railPin} />
                </button>
              ))}
              {isError && <button className={styles.railRetry} onClick={() => void refetch()}>Refresh properties</button>}
              {!updating && results?.items.length === 0 && <button className={styles.railRetry} onClick={resetBrowsing}>No matches. Clear filters</button>}
            </div>
          </div>
        </aside>
        <div className={styles.mapViewport}>
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
          <div className={styles.mapTools}><MapToolbar localities={localities} /></div>
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
          <Link className={styles.browseLink} href="#explore"><Grid2X2 size={15} aria-hidden="true" /> Browse homes</Link>
        </div>
      </section>
      <FilterBar hideInline />

      <div className={styles.explore}>
        <section id="explore" aria-labelledby="explore-title">
          <div className={styles.sectionHeader}>
            <div><p className={styles.sectionEyebrow}>Make room for what’s next</p><h2 id="explore-title">{filters.listingType === "buy" ? "Homes for sale." : "Homes for rent."}</h2></div>
            <Link href={searchHref} className={styles.textLink}>Explore all homes</Link>
          </div>
          <div className={styles.resultOptions} role="group" aria-label="Property browsing options">
            <label><span>Locality</span><div className={styles.optionSelect}><select aria-label="Property locality" value={filters.localitySlugs.length > 1 ? "multiple" : currentLocality} onChange={(event) => chooseLocality(event.target.value)}>
              <option value="">All localities</option>{localities.map(({ slug, name }) => <option key={slug} value={slug}>{name}</option>)}
              {filters.localitySlugs.length > 1 && <option value="multiple" disabled>Multiple localities</option>}
            </select><ChevronDown size={13} aria-hidden="true" /></div></label>
            <label><span>Budget</span><div className={styles.optionSelect}><select aria-label="Property budget" value={filters.priceMin !== null ? "custom" : filters.priceMax ?? ""} onChange={(event) => setFilters({ priceMin: null, priceMax: Number(event.target.value) || null })}><BudgetOptions filters={filters} /></select><ChevronDown size={13} aria-hidden="true" /></div></label>
            <label><span>Bedrooms</span><div className={styles.optionSelect}><select aria-label="Property bedrooms" value={filters.bedrooms.length > 1 ? "multiple" : filters.bedrooms[0] ?? ""} onChange={(event) => setFilters({ bedrooms: event.target.value ? [Number(event.target.value)] : [] })}><BedroomOptions filters={filters} /></select><ChevronDown size={13} aria-hidden="true" /></div></label>
            <label><span>Property type</span><div className={styles.optionSelect}><select aria-label="Property type" value={filters.propertyTypes.length > 1 ? "multiple" : filters.propertyTypes[0] ?? ""} onChange={(event) => setFilters({ propertyTypes: event.target.value ? [event.target.value as PropertyType] : [] })}>
              <option value="">All types</option>{PROPERTY_TYPES.map((type) => <option key={type} value={type}>{propertyTypeLabel(type)}</option>)}{filters.propertyTypes.length > 1 && <option value="multiple" disabled>Multiple types</option>}
            </select><ChevronDown size={13} aria-hidden="true" /></div></label>
            <label><span>Sort by</span><div className={styles.optionSelect}><select aria-label="Property sort order" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>{SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={13} aria-hidden="true" /></div></label>
            <div className={styles.optionActions}>
              <button type="button" onClick={() => setFiltersOpen(true)} aria-expanded={filtersOpen}><SlidersHorizontal size={14} aria-hidden="true" /> More filters{filterCount > 0 && ` (${filterCount})`}</button>
              {(filterCount > 0 || sort !== "relevance") && <button type="button" onClick={resetBrowsing}>Reset</button>}
            </div>
          </div>
          <p className={styles.resultsSummary} role="status">{mapCount}{focusedLocality ? ` in ${focusedLocality.name}` : " across Hyderabad"} · {updating ? "Refreshing properties" : `Showing ${results?.items.length ?? 0} ${results?.items.length === 1 ? "property" : "properties"}`}</p>
          <div className={styles.results} aria-busy={updating}>
            {isError ? (
              <div className={styles.empty}>Couldn’t refresh homes. <button onClick={() => refetch()}>Try again</button></div>
            ) : results?.items.length === 0 ? (
              <div className={styles.empty}>No homes match this search. <button onClick={resetBrowsing}>Clear filters</button></div>
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
  const price = property.listingType === "rent" ? property.rentMonthly == null ? "Rent on request" : formatRent(property.rentMonthly) : formatPrice(property.price);
  const isPlot = property.propertyType === "plot";
  const amenities = property.amenities.map((slug) => AMENITIES.find((amenity) => amenity.slug === slug)?.name ?? slug);
  return (
    <article className="relative">
      <Link href={`/property/${property.slug}`} className={styles.card}>
        <div className={styles.cardVisual}>
          <Img src={property.images[0]?.url ?? ""} alt="" className={styles.cardImage} sizes="(max-width: 640px) 95vw, (max-width: 900px) 48vw, 32vw" />
          <span className={styles.cardBadge}>{property.listingType === "buy" ? "For sale" : "For rent"}</span>
        </div>
        <div className={styles.cardBody}>
          <strong>{price}</strong>
          <h3 className={styles.cardTitle}>{property.title}</h3>
          <p className={styles.address}>{property.address}</p>
          <p className={styles.cardFacts}>
            {property.bedrooms > 0 && <span><BedDouble size={14} aria-hidden="true" /> {property.bedrooms} BHK</span>}
            {property.bathrooms > 0 && <span><Bath size={14} aria-hidden="true" /> {property.bathrooms} {property.bathrooms === 1 ? "bath" : "baths"}</span>}
            <span>{propertyTypeLabel(property.propertyType)}</span>
          </p>
          <dl className={styles.cardAreas}>
            <div><dt>{isPlot ? "Plot area" : "Built-up"}</dt><dd>{formatArea(property.builtupAreaSqft)}</dd></div>
            {!isPlot && <div><dt>Carpet area</dt><dd>{formatArea(property.carpetAreaSqft)}</dd></div>}
            {!isPlot && property.superBuiltupAreaSqft != null && <div><dt>Super built-up</dt><dd>{formatArea(property.superBuiltupAreaSqft)}</dd></div>}
          </dl>
          <div className={styles.cardStatus}><span>{possessionLabel(property.possession)}</span><span>{property.facing} facing</span></div>
          {amenities.length > 0 && <p className={styles.cardAmenities}>{amenities.slice(0, 2).join(" · ")}{amenities.length > 2 && ` · +${amenities.length - 2} more`}</p>}
          <span className={styles.cardDetailsLink}>View property details</span>
        </div>
      </Link>
      <CompareToggle id={property.id} compact className="absolute right-2 top-2" />
    </article>
  );
}

function BudgetOptions({ filters }: { filters: PropertyFilters }) {
  return <>
    <option value="">Budget</option>
    {BUDGETS[filters.listingType].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    {filters.priceMin !== null && <option value="custom" disabled>Custom budget</option>}
    {filters.priceMax !== null && !BUDGETS[filters.listingType].some(([value]) => value === filters.priceMax) && (
      <option value={filters.priceMax}>{filters.listingType === "buy" ? `Under ${formatPrice(filters.priceMax)}` : `Under ${formatRent(filters.priceMax)}`}</option>
    )}
  </>;
}

function BedroomOptions({ filters }: { filters: PropertyFilters }) {
  return <>
    <option value="">BHK</option>
    {[0, 1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value === 0 ? "Studio" : value === 5 ? "5+ BHK" : `${value} BHK`}</option>)}
    {filters.bedrooms.length > 1 && <option value="multiple" disabled>Multiple BHK</option>}
  </>;
}
