import type { StyleSpecification, LayerSpecification } from "maplibre-gl";
import { CLUSTER_MAX_ZOOM } from "@/lib/map/constants";

export interface PropitPalette {
  land: string;
  landAlt: string;
  water: string;
  green: string;
  road: string;
  roadMajor: string;
  roadCasing: string;
  building: string;
  label: string;
  labelHalo: string;
  labelStrong: string;
  boundary: string;
}

export const LIGHT_PALETTE: PropitPalette = {
  land: "#ece7da",
  landAlt: "#e4dfd2",
  water: "#8abbb8",
  green: "#a9c48f",
  road: "#fffdf8",
  roadMajor: "#fffdf8",
  roadCasing: "#a8a394",
  building: "#d6cec0",
  label: "#4d554c",
  labelHalo: "#f7f4ec",
  labelStrong: "#22332b",
  boundary: "#a8a394",
};

export const DARK_PALETTE: PropitPalette = {
  land: "#0b0b0c",
  landAlt: "#141416",
  water: "#1c3049",
  green: "#1b2e20",
  road: "#3a3a3e",
  roadMajor: "#4a4a4f",
  roadCasing: "#1a1a1c",
  building: "#202024",
  label: "#98989d",
  labelHalo: "#000000",
  labelStrong: "#e8e8ed",
  boundary: "#38383c",
};

const has = (id: string, ...needles: string[]) =>
  needles.some((n) => id.toLowerCase().includes(n));

/**
 * Rewrites a vector basemap into PropIT's palette.
 *
 * Matching is by layer id substring rather than exact ids so the transform
 * survives basemap upgrades and works across Carto / MapTiler sources.
 */
export function applyPropitStyle(
  style: StyleSpecification,
  palette: PropitPalette,
): StyleSpecification {
  const layers: LayerSpecification[] = [];

  for (const raw of style.layers) {
    const layer = structuredClone(raw) as LayerSpecification;
    const id = layer.id;

    // Stock POI iconography and house numbers are noise — PropIT draws its own.
    if (has(id, "poi", "housenumber", "airport-label", "aeroway-label")) continue;

    if (layer.type === "background") {
      layer.paint = { ...layer.paint, "background-color": palette.land };
      layers.push(layer);
      continue;
    }

    if (layer.type === "fill") {
      const paint = { ...(layer.paint ?? {}) } as Record<string, unknown>;
      if (has(id, "water", "ocean", "sea", "river", "lake")) {
        paint["fill-color"] = palette.water;
        paint["fill-opacity"] = 1;
      } else if (has(id, "park", "wood", "grass", "forest", "green", "golf", "pitch", "garden")) {
        paint["fill-color"] = palette.green;
        paint["fill-opacity"] = 0.9;
      } else if (has(id, "building")) {
        paint["fill-color"] = palette.building;
        // Buildings only earn their ink once you're close enough to read streets.
        paint["fill-opacity"] = ["interpolate", ["linear"], ["zoom"], 13, 0, 15.5, 0.75];
      } else if (has(id, "landuse", "landcover", "residential", "industrial", "sand", "wetland")) {
        paint["fill-color"] = palette.landAlt;
        paint["fill-opacity"] = 0.7;
      } else {
        paint["fill-color"] = palette.landAlt;
        paint["fill-opacity"] = 0.5;
      }
      delete paint["fill-pattern"];
      layer.paint = paint as never;
      layers.push(layer);
      continue;
    }

    if (layer.type === "line") {
      const paint = { ...(layer.paint ?? {}) } as Record<string, unknown>;
      if (has(id, "water", "river", "stream", "canal")) {
        paint["line-color"] = palette.water;
      } else if (has(id, "boundary", "admin")) {
        paint["line-color"] = palette.boundary;
        paint["line-opacity"] = 0.6;
        paint["line-dasharray"] = [2, 2];
      } else if (has(id, "casing")) {
        // Casings sit beneath their roadway and supply all of its definition.
        paint["line-color"] = palette.roadCasing;
        paint["line-opacity"] = 0.9;
      } else if (has(id, "motorway", "trunk", "primary")) {
        paint["line-color"] = palette.roadMajor;
      } else if (has(id, "rail", "transit", "subway")) {
        paint["line-color"] = palette.boundary;
        paint["line-opacity"] = 0.5;
      } else {
        paint["line-color"] = palette.road;
      }
      layer.paint = paint as never;
      layers.push(layer);
      continue;
    }

    if (layer.type === "symbol") {
      const paint = { ...(layer.paint ?? {}) } as Record<string, unknown>;
      const layout = { ...(layer.layout ?? {}) } as Record<string, unknown>;

      // A symbol layer needs text-field or icon-image. Icon-only layers are the
      // basemap's stock glyphs — drop the layer rather than emptying it, which
      // would produce an invalid style and stop the whole map from loading.
      if (!layout["text-field"]) continue;
      delete layout["icon-image"];

      const sourceLayer = (layer as { "source-layer"?: string })["source-layer"];
      const isPlace = has(id, "place", "city", "town", "state", "country", "suburb", "neighbourhood");
      paint["text-color"] = isPlace ? palette.labelStrong : palette.label;
      paint["text-halo-color"] = palette.labelHalo;
      paint["text-halo-width"] = 1.2;
      paint["text-halo-blur"] = 0.4;

      // PropIT's own type, not the basemap's.
      layout["text-font"] = ["Open Sans Regular"];
      layout["text-letter-spacing"] = isPlace ? 0.04 : 0.01;

      // Street names appear once streets are what you're actually looking at.
      // Pushed too late, the map reads as an empty field at city zoom.
      if (has(id, "road", "street", "highway", "motorway")) {
        layer.minzoom = Math.max(layer.minzoom ?? 0, 12);
      }

      // PropIT draws its own locality labels, with a live count attached. Below
      // the cluster zoom those are on screen, and the basemap's own place names
      // sit directly underneath them saying the same word twice. Hold the
      // basemap's back until PropIT's pills have given way to prices.
      //
      // Matched on source-layer, not id: the worst offender is called
      // `label_other` and matches none of the words you would guess, while
      // every place label — whatever its id — reads from the `place` layer.
      if (isPlace || sourceLayer === "place") {
        layer.minzoom = Math.max(layer.minzoom ?? 0, CLUSTER_MAX_ZOOM);
      }

      layer.paint = paint as never;
      layer.layout = layout as never;
      layers.push(layer);
      continue;
    }

    layers.push(layer);
  }

  // The sprite is dropped deliberately: every stock icon has been stripped
  // above, and PropIT supplies its own images via addImage. Keeping it would
  // make style load depend on a sprite sheet nothing references — and MapLibre
  // will not mark a style loaded until its sprite resolves.
  const next = { ...style, layers } as StyleSpecification & { sprite?: unknown };
  delete next.sprite;
  return next;
}

/**
 * Module-level cache of the *raw* basemap JSON.
 *
 * MapLibre takes ownership of the style object it is handed and mutates it in
 * place, so every consumer must get its own copy — sharing one object across
 * map instances (StrictMode mounts two) leaves the second with a style that
 * never finishes loading. Caching the fetch still saves the network round-trip.
 */
const rawCache = new Map<string, Promise<StyleSpecification>>();

export async function loadPropitStyle(
  url: string,
  theme: "light" | "dark",
): Promise<StyleSpecification> {
  let raw = rawCache.get(url);
  if (!raw) {
    raw = (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Basemap unavailable (${res.status})`);
      return (await res.json()) as StyleSpecification;
    })();
    // A failed fetch must not poison the cache — later mounts should retry.
    raw.catch(() => rawCache.delete(url));
    rawCache.set(url, raw);
  }

  const style = structuredClone(await raw);
  return applyPropitStyle(style, theme === "dark" ? DARK_PALETTE : LIGHT_PALETTE);
}

/** Last-resort style so the map never renders as a blank rectangle. */
export function fallbackStyle(theme: "light" | "dark"): StyleSpecification {
  const p = theme === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
  return {
    version: 8,
    name: "PropIT Fallback",
    sources: {},
    layers: [{ id: "background", type: "background", paint: { "background-color": p.land } }],
    // Served by PropIT — a fallback style must not depend on a CDN.
    glyphs: "/fonts/{fontstack}/{range}.pbf",
  };
}
