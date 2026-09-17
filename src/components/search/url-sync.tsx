"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useDiscovery, filtersToParams } from "@/store/discovery";
import { DEFAULT_FILTERS } from "@/lib/data/filters";
import type { Anchor, PossessionStatus, PropertyFilters, PropertyType } from "@/types";

const TYPES: PropertyType[] = [
  "apartment", "villa", "plot", "independent_house", "penthouse", "farmhouse", "commercial",
];
const POSSESSIONS: PossessionStatus[] = [
  "ready", "within_6_months", "within_1_year", "under_construction",
];

function parse(sp: URLSearchParams): { filters: PropertyFilters; anchors: Anchor[] | null; radius: { lat: number; lng: number; km: number } | null } {
  const list = (k: string) =>
    (sp.get(k) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const num = (k: string) => {
    const v = sp.get(k);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const filters: PropertyFilters = {
    ...DEFAULT_FILTERS,
    listingType: sp.get("type") === "rent" ? "rent" : "buy",
    propertyTypes: list("propertyType").filter((t): t is PropertyType => TYPES.includes(t as PropertyType)),
    bedrooms: list("bhk").map(Number).filter((n) => Number.isFinite(n)),
    priceMin: num("minPrice"),
    priceMax: num("maxPrice"),
    areaMin: num("minArea"),
    areaMax: num("maxArea"),
    possession: list("possession").filter((p): p is PossessionStatus => POSSESSIONS.includes(p as PossessionStatus)),
    amenities: list("amenities"),
    localitySlugs: list("locality"),
    verifiedOnly: sp.get("verified") === "1",
  };

  let anchors: Anchor[] | null = null;
  const raw = sp.get("anchors");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Anchor[];
      if (Array.isArray(parsed)) anchors = parsed.slice(0, 6);
    } catch {
      anchors = null;
    }
  }

  const lat = num("lat");
  const lng = num("lng");
  const km = num("radiusKm");
  return {
    filters,
    anchors,
    radius: lat != null && lng != null && km != null ? { lat, lng, km } : null,
  };
}

/**
 * Two-way binding between the URL and the discovery store.
 *
 * Inbound: a link like /search?type=rent&bhk=3 arrives fully applied.
 * Outbound: every change rewrites the querystring via replaceState, so any
 * search is a shareable link without adding history entries as the user filters.
 */
export function SearchUrlSync() {
  const searchParams = useSearchParams();
  const lastWritten = useRef<string | null>(null);
  const applied = useRef<string | null>(null);

  // ---- URL → store ----
  useEffect(() => {
    const incoming = searchParams.toString();
    // Ignore the echo of our own replaceState.
    if (incoming === lastWritten.current || incoming === applied.current) return;
    applied.current = incoming;

    const { filters, anchors, radius } = parse(new URLSearchParams(incoming));
    const store = useDiscovery.getState();
    store.setFilters(filters);
    store.setUseBounds(false);
    if (anchors) {
      store.clearAnchors();
      for (const a of anchors) store.addAnchor(a);
    }
    if (radius) {
      store.setRadius({ center: { lat: radius.lat, lng: radius.lng }, km: radius.km, label: "Search area" });
      store.flyTo({ lat: radius.lat, lng: radius.lng }, 12.4);
    }
  }, [searchParams]);

  // ---- store → URL ----
  useEffect(() =>
    useDiscovery.subscribe((state, prev) => {
      if (
        state.filters === prev.filters &&
        state.anchors === prev.anchors &&
        state.radius === prev.radius
      ) {
        return;
      }
      const next = filtersToParams(state.filters, state.anchors, state.radius).toString();
      if (next === lastWritten.current) return;
      lastWritten.current = next;
      window.history.replaceState(null, "", next ? `?${next}` : window.location.pathname);
    }),
  []);

  return null;
}
