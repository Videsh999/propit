import "server-only";
import type { Locality, Poi, Project, Property, LatLng, Bounds } from "@/types";
import { generate } from "./generate";
import { DEVELOPERS, DEVELOPER_BY_ID } from "./developers";
import { POIS } from "./pois";
import { HYDERABAD } from "./localities";

/**
 * In-memory store with a uniform grid spatial index — the development stand-in
 * for PostGIS. Every query in repository.ts goes through this, so swapping in
 * Postgres means reimplementing this module alone.
 *
 * Grid cell ≈ 1.1 km, which keeps radius lookups to a handful of buckets.
 */
const CELL = 0.01;

function cellKey(p: LatLng) {
  return `${Math.floor(p.lat / CELL)}:${Math.floor(p.lng / CELL)}`;
}

export interface Store {
  city: typeof HYDERABAD;
  localities: Locality[];
  localityById: Map<string, Locality>;
  localityBySlug: Map<string, Locality>;
  projects: Project[];
  projectById: Map<string, Project>;
  projectBySlug: Map<string, Project>;
  properties: Property[];
  propertyById: Map<string, Property>;
  propertyBySlug: Map<string, Property>;
  propertiesByLocality: Map<string, Property[]>;
  propertiesByProject: Map<string, Property[]>;
  pois: Poi[];
  poiById: Map<string, Poi>;
  developers: typeof DEVELOPERS;
  developerById: typeof DEVELOPER_BY_ID;
  propertyGrid: Map<string, Property[]>;
  poiGrid: Map<string, Poi[]>;
}

function buildGrid<T extends { location: LatLng }>(items: T[]): Map<string, T[]> {
  const grid = new Map<string, T[]>();
  for (const it of items) {
    const k = cellKey(it.location);
    const arr = grid.get(k);
    if (arr) arr.push(it);
    else grid.set(k, [it]);
  }
  return grid;
}

function build(): Store {
  const { projects, properties, localities } = generate();

  const propertiesByLocality = new Map<string, Property[]>();
  const propertiesByProject = new Map<string, Property[]>();
  for (const p of properties) {
    const l = propertiesByLocality.get(p.localityId);
    if (l) l.push(p);
    else propertiesByLocality.set(p.localityId, [p]);
    if (p.projectId) {
      const pr = propertiesByProject.get(p.projectId);
      if (pr) pr.push(p);
      else propertiesByProject.set(p.projectId, [p]);
    }
  }

  return {
    city: HYDERABAD,
    localities,
    localityById: new Map(localities.map((l) => [l.id, l])),
    localityBySlug: new Map(localities.map((l) => [l.slug, l])),
    projects,
    projectById: new Map(projects.map((p) => [p.id, p])),
    projectBySlug: new Map(projects.map((p) => [p.slug, p])),
    properties,
    propertyById: new Map(properties.map((p) => [p.id, p])),
    propertyBySlug: new Map(properties.map((p) => [p.slug, p])),
    propertiesByLocality,
    propertiesByProject,
    pois: POIS,
    poiById: new Map(POIS.map((p) => [p.id, p])),
    developers: DEVELOPERS,
    developerById: DEVELOPER_BY_ID,
    propertyGrid: buildGrid(properties),
    poiGrid: buildGrid(POIS),
  };
}

// Survives hot reload in dev so the dataset stays stable across edits.
const g = globalThis as unknown as { __propitStore?: Store };
export function getStore(): Store {
  if (!g.__propitStore) g.__propitStore = build();
  return g.__propitStore;
}

/** Cells intersecting a bounds box — the index scan. */
export function cellsForBounds(b: Bounds): string[] {
  const keys: string[] = [];
  const y0 = Math.floor(b.south / CELL);
  const y1 = Math.floor(b.north / CELL);
  const x0 = Math.floor(b.west / CELL);
  const x1 = Math.floor(b.east / CELL);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) keys.push(`${y}:${x}`);
  return keys;
}

export function cellsForRadius(center: LatLng, radiusKm: number): string[] {
  const latPad = radiusKm / 110.574;
  const lngPad = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  return cellsForBounds({
    west: center.lng - lngPad,
    east: center.lng + lngPad,
    south: center.lat - latPad,
    north: center.lat + latPad,
  });
}
