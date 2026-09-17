import { setWorkerUrl } from "maplibre-gl";

/**
 * Point MapLibre at a worker the server can actually serve.
 *
 * MapLibre does all vector-tile parsing in a Web Worker. Left to itself it
 * builds that worker's URL through the bundler, and under Next 16 that URL came
 * back as an HTML 404 page — the browser refused the module, the worker never
 * started, and the map painted nothing at all while reporting no error. The
 * style, the TileJSON and the tiles themselves were all loading correctly the
 * whole time, which is precisely why the symptom read as "the map is missing"
 * rather than as a specific failure.
 *
 * `scripts/sync-maplibre-worker.mjs` copies the worker and its shared chunk
 * into `public/maplibre/` before every dev run and build, so this path is a
 * static file served with a real JavaScript content type.
 *
 * Imported for its side effect, and it must run before the first Map is
 * constructed — hence module scope in a module the map imports, rather than an
 * effect that would race the map's own creation.
 */
export const MAPLIBRE_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

if (typeof window !== "undefined") {
  setWorkerUrl(MAPLIBRE_WORKER_URL);
}
