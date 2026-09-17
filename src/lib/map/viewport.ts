/**
 * PropIT is a Hyderabad product, so the map is a Hyderabad map.
 *
 * The camera opens on, and is fenced to, the metro area — the user can never
 * pan off to open ocean or zoom out to a world view with a few dots on it.
 *
 * These bounds are the real Outer Ring Road's extent, taken from the geometry
 * in public/data/orr.json (OSM relation 5634923). Regenerate both together with
 * `node scripts/fetch-orr.mjs`.
 */
export const ORR_BBOX = { west: 78.235, south: 17.203, east: 78.685, north: 17.608 } as const;

export const ORR_BOUNDS: [[number, number], [number, number]] = [
  [ORR_BBOX.west, ORR_BBOX.south],
  [ORR_BBOX.east, ORR_BBOX.north],
];

export const HYDERABAD_CENTER = {
  longitude: (ORR_BBOX.west + ORR_BBOX.east) / 2,
  latitude: (ORR_BBOX.south + ORR_BBOX.north) / 2,
};

/**
 * How far the user may roam: the ring plus the growth corridors just outside it
 * — Shamshabad and the airport, Adibatla, Medchal, Pocharam — and no further.
 */
const ROAM = 0.28;
export const HYDERABAD_MAX_BOUNDS: [number, number, number, number] = [
  ORR_BBOX.west - ROAM,
  ORR_BBOX.south - ROAM,
  ORR_BBOX.east + ROAM,
  ORR_BBOX.north + ROAM,
];

/** The opening shot: the whole ring, comfortably inset. */
export const INITIAL_FIT = {
  bounds: ORR_BOUNDS,
  fitBoundsOptions: { padding: 40 },
};

export const MIN_ZOOM = 9.2;
export const MAX_ZOOM = 17.5;

/** Static asset — deliberately not bundled. See the note above. */
export const ORR_URL = "/data/orr.json";
