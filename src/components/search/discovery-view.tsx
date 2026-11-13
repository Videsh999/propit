"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { ChevronDown, Bookmark, MessageCircle, Inbox, SlidersHorizontal, MapPin, Search as SearchIcon } from "lucide-react";
import { PropitMap } from "@/components/map/propit-map";
import { MapCommandBar } from "@/components/map/map-command-bar";
import { AnchorsPanel } from "@/components/anchors/anchors-panel";
import { LocalityPanel } from "@/components/locality/locality-panel";
import { PropertyPreview } from "@/components/property/property-preview";
import { PropertyCard } from "@/components/property/property-card";
import { FilterBar } from "@/components/filters/filter-bar";
import { SearchInput } from "@/components/search/search-input";
import { PropertyCardSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useProperties, useZone } from "@/lib/hooks/use-properties";
import { useApplyRelaxation } from "@/lib/hooks/use-relaxation";
import { useDiscovery } from "@/store/discovery";
import { formatCount } from "@/lib/format";
import type { Locality, Poi } from "@/types";
import { cn } from "@/lib/utils";
import { BottomSheet, type Detent } from "@/components/ui/bottom-sheet";
import { useSelectedProperty } from "@/lib/hooks/use-selected-property";
import { useBoundsDrift } from "@/lib/hooks/use-bounds-drift";
import { useIsMobile } from "@/lib/hooks/use-media-query";

type LocalityLite = Pick<Locality, "slug" | "name" | "center" | "boundary" | "avgPriceSqft">;

const SORTS = [
  { v: "relevance", label: "Most relevant" },
  { v: "fit", label: "Best fit" },
  { v: "price_asc", label: "Price: low to high" },
  { v: "price_desc", label: "Price: high to low" },
  { v: "area_desc", label: "Largest first" },
  { v: "newest", label: "Newest" },
] as const;

export function DiscoveryView({
  localities,
  pois,
  projects,
}: {
  localities: LocalityLite[];
  pois: Poi[];
  projects: { id: string; slug: string; name: string; localityId: string; lat: number; lng: number; priceMin: number }[];
}) {
  const {
    setBounds, viewMode, anchors, filters, select,
    selectedLocalitySlug, selectedPropertyId, saveSearch, savedSearches,
    radius, setRadius, sort, setSort, setFiltersOpen, setAnchorsOpen, setAssistantOpen,
  } = useDiscovery();

  const { data: queryData, isLoading: queryLoading, isPlaceholderData, isError, error, refetch } = useProperties({ limit: 40 });
  const focusedLocality = filters.localitySlugs.length === 1
    ? localities.find(({ slug }) => slug === filters.localitySlugs[0])
    : undefined;
  const data = focusedLocality && isPlaceholderData ? undefined : queryData;
  const isLoading = queryLoading || Boolean(focusedLocality && isPlaceholderData);
  const { data: zone } = useZone();
  const [savedNote, setSavedNote] = useState(false);
  const [detent, setDetent] = useState<Detent>(1);
  const listRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const localityById = useMemo(
    () => new Map(localities.map((l) => [`loc_${l.slug}`, l.name])),
    [localities],
  );

  const drifted = useBoundsDrift();
  const preview = useSelectedProperty(isPlaceholderData ? undefined : data?.items);

  // Scroll the list back to the top whenever the query changes materially.
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [filters, anchors, radius]);

  const showMap = viewMode !== "list";
  const showList = viewMode !== "map";

  const resultsHeader = (
    <>
      <div className="space-y-3 border-b border-line px-4 py-3">
        <SearchInput size="md" placeholder="Search or describe what you want…" />
        <FilterBar />
      </div>
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <p className="text-[13px] text-muted">
          {isLoading ? (
            <span className="text-faint">Searching…</span>
          ) : (
            <>
              <span className="tnum font-semibold text-ink">{formatCount(data?.total ?? 0)}</span>{" "}
              {data?.total === 1 ? "home" : "homes"}
              {focusedLocality && <span> in {focusedLocality.name}</span>}
              {anchors.length > 0 && <span className="text-faint"> in your zone</span>}
            </>
          )}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              saveSearch(
                [
                  filters.bedrooms.length ? `${filters.bedrooms.join("/")} BHK` : null,
                  filters.priceMax ? `under ₹${(filters.priceMax / 1e7).toFixed(2)} Cr` : null,
                  anchors.length ? `near ${anchors.map((a) => a.label).join(" & ")}` : null,
                  filters.localitySlugs[0] ?? null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Saved search",
              );
              setSavedNote(true);
              setTimeout(() => setSavedNote(false), 2200);
            }}
            className="inline-flex h-7 items-center gap-1 rounded-[var(--r-sm)] px-2 text-[12px] text-muted transition-colors hover:bg-sunk hover:text-ink"
          >
            <Bookmark size={12} strokeWidth={1.75} />
            {savedNote ? "Saved" : "Save"}
          </button>
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              aria-label="Sort results"
              className="h-7 appearance-none rounded-[var(--r-sm)] bg-transparent pl-2 pr-6 text-[12px] text-muted outline-none hover:bg-sunk hover:text-ink"
            >
              {SORTS.map((so) => (
                <option key={so.v} value={so.v}>
                  {so.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={11}
              className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-faint"
            />
          </div>
        </div>
      </div>
    </>
  );

  const resultsList = (
    <>
      {isLoading && Array.from({ length: 5 }).map((_, i) => <PropertyCardSkeleton key={i} />)}

      {isError && (
        <div className="px-6 py-12 text-center">
          <p className="text-[14px] text-ink">
            {(error as Error)?.message ?? "Something went wrong."}
          </p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}

      {!isLoading && !isError && (data?.items.length ?? 0) === 0 && <EmptyState />}

      {data?.items.map((p) => (
        <PropertyCard key={p.id} property={p} localityName={localityById.get(p.localityId)} />
      ))}

      {!isLoading && (data?.total ?? 0) > (data?.items.length ?? 0) && (
        <div className="px-4 py-5 text-center text-[12px] text-faint">
          Showing {data?.items.length} of {formatCount(data?.total ?? 0)}. Zoom in or refine to narrow
          the list.
        </div>
      )}
    </>
  );

  const mapPane = (
    <>
      <PropitMap
        localityScope={focusedLocality}
        points={data?.points ?? []}
        contextPoints={data?.contextPoints ?? []}
        localityCounts={data?.localityCounts ?? []}
        projects={focusedLocality ? projects.filter((project) => localityById.get(project.localityId) === focusedLocality.name) : projects}
        localities={focusedLocality ? [focusedLocality] : localities}
        pois={pois}
        zone={zone?.zone ?? null}
        onBoundsChange={setBounds}
      />
      <MapCommandBar boundsDrifted={drifted} localities={localities}
        onChangeView={isMobile ? (mode) => {
          select(null);
          setDetent(mode === "list" ? 2 : mode === "map" ? 0 : 1);
        } : undefined}
        activeView={isMobile ? (detent === 2 ? "list" : detent === 0 ? "map" : "split") : undefined}
      />
      <AnimatePresence>{selectedLocalitySlug && <LocalityPanel />}</AnimatePresence>
      <AnimatePresence>
        <AnchorsPanel />
      </AnimatePresence>
      <AnimatePresence>{!isMobile && selectedPropertyId && (
        <PropertyPreview key={selectedPropertyId} error={preview.isError} onRetry={() => void preview.refetch()} />
      )}</AnimatePresence>

      {radius && (
        <div className="pointer-events-auto absolute bottom-3 right-3 z-20 flex items-center gap-2 rounded-full border border-line bg-[color-mix(in_srgb,var(--paper-raised)_90%,transparent)] px-3 py-1.5 text-[12px] shadow-[var(--e1)] backdrop-blur">
          <span className="text-muted">
            <span className="tnum font-medium text-ink">{radius.km} km</span> of {radius.label}
          </span>
          <button
            onClick={() => setRadius(null)}
            className="text-faint underline underline-offset-2 hover:text-ink"
          >
            clear
          </button>
        </div>
      )}
    </>
  );

  // ---- Mobile: the map owns the screen, results live in a sheet ----
  if (isMobile) {
    return (
      <div className="relative h-[calc(100svh-72px)] overflow-hidden">
        {mapPane}

        <AnimatePresence>
          {selectedPropertyId && <PropertyPreview key={selectedPropertyId} error={preview.isError} onRetry={() => void preview.refetch()}
            className="fixed bottom-[calc(12vh+12px)] z-[41] max-h-[calc(88vh-96px)]" />}
        </AnimatePresence>
        <BottomSheet
          detent={selectedPropertyId ? 0 : detent}
          onDetentChange={(next) => {
            if (next !== 0 && selectedPropertyId) select(null);
            setDetent(next);
          }}
          header={resultsHeader}
        >
          {resultsList}
        </BottomSheet>

        {detent === 0 && !selectedPropertyId && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[calc(12svh+12px)] z-30 flex justify-center gap-1.5 px-3">
            <SheetPill icon={SearchIcon} label={`${formatCount(data?.total ?? 0)} homes`} onClick={() => setDetent(1)} />
            <SheetPill icon={SlidersHorizontal} label="Filters" onClick={() => { setDetent(1); setFiltersOpen(true); }} />
            <SheetPill icon={MapPin} label="Anchors" onClick={() => setAnchorsOpen(true)} />
            <SheetPill icon={MessageCircle} label="Ask" onClick={() => setAssistantOpen(true)} />
          </div>
        )}
      </div>
    );
  }

  // ---- Desktop: map and results side by side ----
  return (
    <div className="flex h-[calc(100svh-72px)]">
      {showMap && (
        <div className={cn("relative min-h-0 flex-1", showList && "border-r border-line")}>
          {mapPane}
        </div>
      )}

      {showList && (
        <div
          className={cn(
            "flex min-h-0 flex-col bg-paper",
            showMap ? "w-full max-w-[420px] shrink-0" : "w-full",
          )}
        >
          {resultsHeader}
          <div ref={listRef} className="scroll-quiet min-h-0 flex-1 overflow-y-auto">
            {resultsList}
          </div>
          {savedSearches.length > 0 && (
            <div className="border-t border-line px-4 py-2 text-[11px] text-faint">
              {savedSearches.length} saved {savedSearches.length === 1 ? "search" : "searches"} in
              your profile
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SheetPill({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof SearchIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-[color-mix(in_srgb,var(--paper-raised)_92%,transparent)] px-3 text-[12px] font-medium text-ink shadow-[var(--e2)] backdrop-blur"
    >
      <Icon size={13} strokeWidth={1.75} />
      {label}
    </button>
  );
}

/** Zero results is a conversation, not a dead end. */
function EmptyState() {
  const { anchors, filters, setFilters, updateAnchor, setAssistantOpen, radius, setRadius } =
    useDiscovery();
  const { data: zone } = useZone();
  const applyRelaxation = useApplyRelaxation();
  const relaxations = zone?.relaxations ?? [];

  return (
    <div className="px-6 py-10">
      <Inbox size={20} strokeWidth={1.5} className="text-faint" />
      <h3 className="mt-3 text-[16px] font-medium text-ink">No exact match — yet</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        {relaxations.length
          ? relaxations[0].message
          : "Nothing fits every constraint at once. Widening one of them usually opens things up."}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {relaxations.slice(0, 3).map((r) => (
          <Button
            key={r.label}
            size="sm"
            variant={r === relaxations[0] ? "primary" : "secondary"}
            onClick={() => applyRelaxation(r)}
          >
            {r.label}
          </Button>
        ))}

        {relaxations.length === 0 && (
          <>
            {filters.priceMax != null && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setFilters({ priceMax: Math.round(filters.priceMax! * 1.3) })}
              >
                Raise budget 30%
              </Button>
            )}
            {radius && (
              <Button size="sm" variant="secondary" onClick={() => setRadius({ ...radius, km: radius.km * 2 })}>
                Double the radius
              </Button>
            )}
            {filters.bedrooms.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setFilters({ bedrooms: [] })}>
                Any bedrooms
              </Button>
            )}
            {anchors.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => anchors.forEach((a) => updateAnchor(a.id, { maxKm: a.maxKm * 1.6 }))}
              >
                Widen every anchor
              </Button>
            )}
          </>
        )}
      </div>

      <button
        onClick={() => setAssistantOpen(true)}
        className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-accent underline-offset-4 hover:underline"
      >
        <MessageCircle size={13} strokeWidth={1.75} />
        Ask PropIT what to change
      </button>
    </div>
  );
}
