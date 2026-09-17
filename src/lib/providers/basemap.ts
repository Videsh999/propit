import type { StyleSpecification } from "maplibre-gl";
import { applyPropitStyle, DARK_PALETTE, LIGHT_PALETTE } from "@/lib/map/propit-style";

export type MapTheme = "light" | "dark";

/**
 * Basemap providers, in the order PropIT tries them.
 *
 * CARTO is deliberately absent. As of 2026 their keyless raster tiles — Positron
 * and Voyager alike — are returned stamped "API KEY REQUIRED" across the whole
 * image, which is unusable for a product.
 *
 * OpenFreeMap is the primary: genuinely free, no key, no watermark, and — the
 * part that matters operationally — its style, sprites, glyphs and tiles all
 * come from one origin. The earlier vector setup split those across
 * `basemaps.cartocdn.com` and `tiles*.basemaps.cartocdn.com`, so a network that
 * blocked only the tile host left the style waiting forever on glyphs and the
 * map rendered nothing at all.
 *
 * Behind it sit two raster providers on unrelated domains. Raster has far fewer
 * moving parts: if the images arrive, the map is on screen.
 */
export interface BasemapSource {
  id: string;
  name: string;
  kind: "vector" | "raster";
  /** Vector only: a style JSON that PropIT restyles to its own palette. */
  styleUrl?: string;
  /** Raster only. */
  tiles?: string[];
  tileSize?: number;
  maxzoom?: number;
  attribution: string;
  /** Raster only: keeps third-party imagery inside PropIT's palette. */
  filter?: { saturation: number; contrast: number; brightnessMin: number; brightnessMax: number };
}

const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const OPENFREEMAP: BasemapSource = {
  id: "openfreemap",
  name: "OpenFreeMap",
  kind: "vector",
  styleUrl: "https://tiles.openfreemap.org/styles/positron",
  attribution: `${OSM_ATTRIBUTION}, © <a href="https://openfreemap.org">OpenFreeMap</a>`,
};

const ESRI_LIGHT_GRAY: BasemapSource = {
  id: "esri-light-gray",
  name: "Esri Light Gray Canvas",
  kind: "raster",
  tiles: [
    "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  ],
  tileSize: 256,
  maxzoom: 16,
  attribution: "© Esri, HERE, Garmin, © OpenStreetMap contributors",
  filter: { saturation: -0.1, contrast: 0.05, brightnessMin: 0.04, brightnessMax: 1 },
};

const OSM: BasemapSource = {
  id: "osm",
  name: "OpenStreetMap",
  kind: "raster",
  tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
  tileSize: 256,
  maxzoom: 19,
  attribution: OSM_ATTRIBUTION,
  // OSM standard is vivid; pull it back so property markers stay dominant.
  filter: { saturation: -0.55, contrast: 0.03, brightnessMin: 0.06, brightnessMax: 0.98 },
};

export function basemapSources(): BasemapSource[] {
  const chain = [OPENFREEMAP, ESRI_LIGHT_GRAY, OSM];
  const customTiles = process.env.NEXT_PUBLIC_MAP_TILE_URL;
  const customStyle = process.env.NEXT_PUBLIC_MAP_STYLE_URL;

  // A configured provider always leads, with the public ones as a safety net.
  if (customStyle) {
    return [
      {
        id: "custom-style",
        name: "Configured style",
        kind: "vector",
        styleUrl: customStyle,
        attribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ?? "© Map data contributors",
      },
      ...chain,
    ];
  }
  if (customTiles) {
    return [
      {
        id: "custom-tiles",
        name: "Configured tiles",
        kind: "raster",
        tiles: [customTiles],
        tileSize: 256,
        maxzoom: 20,
        attribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ?? "© Map data contributors",
      },
      ...chain,
    ];
  }
  return chain;
}

/** Glyphs are served from PropIT itself, so labels never depend on a CDN. */
export const GLYPHS_URL = "/fonts/{fontstack}/{range}.pbf";

const GROUND = { light: "#F0ECE3", dark: "#15140F" } as const;

/** Raster styles are built in memory — nothing to fetch, nothing to hang on. */
export function buildRasterStyle(source: BasemapSource, theme: MapTheme): StyleSpecification {
  const f = source.filter;
  return {
    version: 8,
    name: `PropIT · ${source.name}`,
    glyphs: GLYPHS_URL,
    sources: {
      basemap: {
        type: "raster",
        tiles: source.tiles ?? [],
        tileSize: source.tileSize ?? 256,
        maxzoom: source.maxzoom ?? 19,
        attribution: source.attribution,
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": GROUND[theme] } },
      {
        id: "basemap",
        type: "raster",
        source: "basemap",
        paint: {
          "raster-opacity": 1,
          ...(f
            ? {
                "raster-saturation": f.saturation,
                "raster-contrast": f.contrast,
                "raster-brightness-min": f.brightnessMin,
                "raster-brightness-max": f.brightnessMax,
              }
            : {}),
        },
      },
    ],
  };
}

/**
 * Fetches a vector style and rewrites it into PropIT's palette.
 *
 * Glyphs are repointed at this app so a blocked font CDN can never stall the
 * style — that failure renders an entirely blank map, not just missing labels.
 */
export async function loadVectorStyle(
  source: BasemapSource,
  theme: MapTheme,
  signal?: AbortSignal,
): Promise<StyleSpecification> {
  const res = await fetch(source.styleUrl!, { signal });
  if (!res.ok) throw new Error(`${source.name} style unavailable (${res.status})`);
  const raw = (await res.json()) as StyleSpecification;
  const styled = applyPropitStyle(
    structuredClone(raw),
    theme === "dark" ? DARK_PALETTE : LIGHT_PALETTE,
  );
  return { ...styled, glyphs: GLYPHS_URL };
}

/** Last resort so the container is never an empty rectangle. */
export function groundOnlyStyle(theme: MapTheme): StyleSpecification {
  return {
    version: 8,
    name: "PropIT · offline",
    glyphs: GLYPHS_URL,
    sources: {},
    layers: [{ id: "background", type: "background", paint: { "background-color": GROUND[theme] } }],
  };
}
