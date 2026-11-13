"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Anchor,
  AnchorKind,
  Bounds,
  LatLng,
  PoiCategory,
  PropertyFilters,
  ScoredProperty,
} from "@/types";
import { DEFAULT_FILTERS } from "@/lib/data/filters";

export const MAX_COMPARE_PROPERTIES = 4;

export type ViewMode = "split" | "map" | "list";
export type DrawMode = "none" | "circle" | "polygon" | "rectangle";

/** Imperative one-shot instruction for the map component to consume. */
export interface MapCommand {
  id: number;
  kind: "flyTo" | "fitBounds";
  center?: LatLng;
  zoom?: number;
  bounds?: Bounds;
  /** Shift the target left so a right-hand panel doesn't cover it. */
  offsetX?: number;
}

export interface RadiusState {
  center: LatLng;
  km: number;
  label: string;
  anchorId?: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  createdAt: string;
  filters: PropertyFilters;
  anchors: Anchor[];
  radius: RadiusState | null;
}

interface DiscoveryState {
  filters: PropertyFilters;
  anchors: Anchor[];
  radius: RadiusState | null;
  polygon: [number, number][] | null;
  drawMode: DrawMode;

  bounds: Bounds | null;
  zoom: number;
  /** Bounds the last results were fetched for — powers "Search this area". */
  searchedBounds: Bounds | null;
  useBounds: boolean;

  selectedPropertyId: string | null;
  hoveredPropertyId: string | null;
  selectedLocalitySlug: string | null;
  previewProperty: ScoredProperty | null;
  viewedProperty: { id: string; slug: string; title: string } | null;
  setViewedProperty: (property: DiscoveryState["viewedProperty"]) => void;

  compareIds: string[];
  savedIds: string[];
  recentIds: string[];
  savedSearches: SavedSearch[];

  layers: Record<string, boolean>;
  viewMode: ViewMode;
  anchorsOpen: boolean;
  filtersOpen: boolean;
  assistantOpen: boolean;
  assistantDraft: string | null;
  paletteOpen: boolean;

  command: MapCommand | null;
  sort: "relevance" | "price_asc" | "price_desc" | "newest" | "area_desc" | "fit";

  setFilters: (patch: Partial<PropertyFilters>) => void;
  resetFilters: () => void;
  toggleArrayFilter: <K extends "propertyTypes" | "bedrooms" | "possession" | "amenities" | "localitySlugs">(
    key: K,
    value: PropertyFilters[K][number],
  ) => void;

  addAnchor: (a: Omit<Anchor, "id"> & { id?: string }) => string;
  updateAnchor: (id: string, patch: Partial<Anchor>) => void;
  removeAnchor: (id: string) => void;
  clearAnchors: () => void;
  prioritiseAnchor: (id: string | null) => void;

  setRadius: (r: RadiusState | null) => void;
  setPolygon: (p: [number, number][] | null) => void;
  setDrawMode: (m: DrawMode) => void;

  setBounds: (b: Bounds, zoom: number) => void;
  commitBounds: () => void;
  setUseBounds: (v: boolean) => void;

  select: (id: string | null, property?: ScoredProperty | null) => void;
  hover: (id: string | null) => void;
  selectLocality: (slug: string | null) => void;

  toggleCompare: (id: string) => void;
  addToCompare: (id: string) => void;
  clearCompare: () => void;
  toggleSaved: (id: string) => void;
  pushRecent: (id: string) => void;
  saveSearch: (name: string) => void;
  removeSavedSearch: (id: string) => void;
  applySavedSearch: (id: string) => void;

  toggleLayer: (l: PoiCategory | "localities" | "priceHeat" | "projects") => void;
  setViewMode: (m: ViewMode) => void;
  setAnchorsOpen: (v: boolean) => void;
  setFiltersOpen: (v: boolean) => void;
  setAssistantOpen: (v: boolean) => void;
  setAssistantDraft: (draft: string | null) => void;
  setPaletteOpen: (v: boolean) => void;
  setSort: (s: DiscoveryState["sort"]) => void;

  flyTo: (center: LatLng, zoom?: number, offsetX?: number) => void;
  fitBounds: (b: Bounds) => void;
  consumeCommand: () => void;
}

let cmdId = 0;
const nextId = () => `a_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const ANCHOR_DEFAULT_KM: Record<AnchorKind, number> = {
  office: 6,
  school: 4,
  family: 10,
  gym: 3,
  other: 5,
};

export const useDiscovery = create<DiscoveryState>()(
  persist(
    (set, get) => ({
    filters: { ...DEFAULT_FILTERS },
    anchors: [],
    radius: null,
    polygon: null,
    drawMode: "none",

    bounds: null,
    zoom: 11,
    searchedBounds: null,
    useBounds: false,

    selectedPropertyId: null,
    hoveredPropertyId: null,
    selectedLocalitySlug: null,
    previewProperty: null,
    viewedProperty: null,
    setViewedProperty: (viewedProperty) => set({ viewedProperty }),

    compareIds: [],
    savedIds: [],
    recentIds: [],
    savedSearches: [],

    layers: {
      localities: true,
      projects: true,
      priceHeat: false,
      metro: false,
      school: false,
      hospital: false,
      office_hub: false,
      mall: false,
      park: false,
      stadium: false,
      airport: false,
      railway: false,
      restaurant: false,
      gym: false,
      temple: false,
    },
    viewMode: "split",
    anchorsOpen: false,
    filtersOpen: false,
    assistantOpen: false,
    assistantDraft: null,
    paletteOpen: false,

    command: null,
    sort: "relevance",

    setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
    resetFilters: () =>
      set((s) => ({
        filters: { ...DEFAULT_FILTERS, listingType: s.filters.listingType },
        radius: null,
        polygon: null,
      })),

    toggleArrayFilter: (key, value) =>
      set((s) => {
        const cur = s.filters[key] as unknown[];
        const has = cur.includes(value);
        return {
          filters: {
            ...s.filters,
            [key]: has ? cur.filter((v) => v !== value) : [...cur, value],
          } as PropertyFilters,
        };
      }),

    addAnchor: (a) => {
      const id = a.id ?? nextId();
      set((s) => ({
        anchors: [
          ...s.anchors.filter((x) => x.id !== id),
          {
            ...a,
            id,
            weight: a.weight ?? 1,
            maxKm: a.maxKm ?? ANCHOR_DEFAULT_KM[a.kind] ?? 5,
          } as Anchor,
        ],
        anchorsOpen: true,
      }));
      return id;
    },
    updateAnchor: (id, patch) =>
      set((s) => ({ anchors: s.anchors.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
    removeAnchor: (id) => set((s) => ({ anchors: s.anchors.filter((a) => a.id !== id) })),
    clearAnchors: () => set({ anchors: [] }),
    prioritiseAnchor: (id) =>
      set((s) => ({
        anchors: s.anchors.map((a) => ({ ...a, weight: id === null ? 1 : a.id === id ? 2 : 0.75 })),
      })),

    setRadius: (radius) => set({ radius }),
    setPolygon: (polygon) => set({ polygon }),
    setDrawMode: (drawMode) => set({ drawMode }),

    setBounds: (bounds, zoom) =>
      set((st) => ({
        bounds,
        zoom,
        // The first report establishes the reference the drift check measures
        // against, so the "Search this area" prompt stays hidden until the user
        // has genuinely moved away from what they were shown.
        searchedBounds: st.searchedBounds ?? bounds,
      })),
    commitBounds: () => set((s) => ({ searchedBounds: s.bounds, useBounds: true })),
    setUseBounds: (useBounds) => set((s) => ({ useBounds, searchedBounds: useBounds ? s.bounds : null })),

    select: (id, property) =>
      set({ selectedPropertyId: id, previewProperty: property ?? null, selectedLocalitySlug: null }),
    hover: (id) => {
      if (get().hoveredPropertyId !== id) set({ hoveredPropertyId: id });
    },
    selectLocality: (slug) => set({ selectedLocalitySlug: slug, selectedPropertyId: null, previewProperty: null }),

    toggleCompare: (id) =>
      set((s) => ({
        compareIds: s.compareIds.includes(id)
          ? s.compareIds.filter((x) => x !== id)
          : s.compareIds.length >= MAX_COMPARE_PROPERTIES
            ? s.compareIds
            : [...s.compareIds, id],
      })),
    addToCompare: (id) => set((s) =>
      s.compareIds.includes(id) || s.compareIds.length >= MAX_COMPARE_PROPERTIES
        ? s
        : { compareIds: [...s.compareIds, id] },
    ),
    clearCompare: () => set({ compareIds: [] }),
    toggleSaved: (id) =>
      set((s) => ({
        savedIds: s.savedIds.includes(id) ? s.savedIds.filter((x) => x !== id) : [...s.savedIds, id],
      })),
    pushRecent: (id) =>
      set((s) => ({ recentIds: [id, ...s.recentIds.filter((x) => x !== id)].slice(0, 24) })),

    saveSearch: (name) =>
      set((s) => ({
        savedSearches: [
          {
            id: nextId(),
            name,
            createdAt: new Date().toISOString(),
            filters: { ...s.filters },
            anchors: s.anchors.map((a) => ({ ...a })),
            radius: s.radius ? { ...s.radius } : null,
          },
          ...s.savedSearches,
        ].slice(0, 30),
      })),
    removeSavedSearch: (id) =>
      set((s) => ({ savedSearches: s.savedSearches.filter((x) => x.id !== id) })),
    applySavedSearch: (id) => {
      const saved = get().savedSearches.find((x) => x.id === id);
      if (!saved) return;
      set({ filters: { ...saved.filters }, anchors: saved.anchors.map((a) => ({ ...a })), radius: saved.radius });
    },

    toggleLayer: (l) => set((s) => ({ layers: { ...s.layers, [l]: !s.layers[l] } })),
    setViewMode: (viewMode) => set({ viewMode }),
    setAnchorsOpen: (anchorsOpen) => set({ anchorsOpen }),
    setFiltersOpen: (filtersOpen) => set({ filtersOpen }),
    setAssistantOpen: (assistantOpen) => set({ assistantOpen }),
    setAssistantDraft: (assistantDraft) => set({ assistantDraft }),
    setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
    setSort: (sort) => set({ sort }),

    flyTo: (center, zoom, offsetX) =>
      set({ command: { id: ++cmdId, kind: "flyTo", center, zoom, offsetX } }),
    fitBounds: (bounds) => set({ command: { id: ++cmdId, kind: "fitBounds", bounds } }),
    consumeCommand: () => set({ command: null }),
    }),
    {
      name: "propit.discovery",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      /**
       * Only what the user deliberately kept survives a reload.
       *
       * Transient view state (map camera, open panels, hover) was never
       * persisted. Neither are filters or anchors any more: restoring them
       * meant a returning visitor opened the homepage already narrowed to a
       * search they made days ago — "172 homes within 4 km of your school"
       * before they had said anything. A search should start from the city.
       * Saved searches are the deliberate version of that, and they remain.
       */
      partialize: (s) => ({
        savedIds: s.savedIds,
        savedSearches: s.savedSearches,
        recentIds: s.recentIds,
        compareIds: s.compareIds,
      }),
      /** v1 blobs carry filters/anchors; drop them rather than rehydrating them. */
      migrate: (persisted, version) => {
        if (version >= 2) return persisted as never;
        const rest = { ...((persisted ?? {}) as Record<string, unknown>) };
        delete rest.filters;
        delete rest.anchors;
        return rest as never;
      },
    },
  ),
);

/** Serialise the current search into querystring params — every search is a URL. */
export function filtersToParams(
  filters: PropertyFilters,
  anchors: Anchor[],
  radius: RadiusState | null,
): URLSearchParams {
  const p = new URLSearchParams();
  p.set("type", filters.listingType);
  if (filters.propertyTypes.length) p.set("propertyType", filters.propertyTypes.join(","));
  if (filters.bedrooms.length) p.set("bhk", filters.bedrooms.join(","));
  if (filters.priceMin != null) p.set("minPrice", String(filters.priceMin));
  if (filters.priceMax != null) p.set("maxPrice", String(filters.priceMax));
  if (filters.areaMin != null) p.set("minArea", String(filters.areaMin));
  if (filters.areaMax != null) p.set("maxArea", String(filters.areaMax));
  if (filters.possession.length) p.set("possession", filters.possession.join(","));
  if (filters.amenities.length) p.set("amenities", filters.amenities.join(","));
  if (filters.localitySlugs.length) p.set("locality", filters.localitySlugs.join(","));
  if (filters.verifiedOnly) p.set("verified", "1");
  if (anchors.length) p.set("anchors", JSON.stringify(anchors));
  if (radius) {
    p.set("lat", radius.center.lat.toFixed(5));
    p.set("lng", radius.center.lng.toFixed(5));
    p.set("radiusKm", String(radius.km));
  }
  return p;
}
