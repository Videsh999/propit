/**
 * Copies MapLibre's worker bundle into public/ so it can be served as a plain
 * static file.
 *
 * MapLibre parses every vector tile inside a Web Worker, which it starts with
 * `new Worker(url, { type: "module" })`. Under Next 16's bundler that URL did
 * not resolve: the request fell through to the app router and came back as an
 * HTML 404 page, so the browser refused it —
 *
 *   Failed to load module script: The server responded with a non-JavaScript
 *   MIME type of "text/html".
 *
 * The worker then never started, no tile was ever parsed, and the map rendered
 * as an empty rectangle with no error on the main thread. Everything else about
 * it — style, TileJSON, tiles, CORS — was fine, which is what made it so hard
 * to see.
 *
 * Copying rather than vendoring: these are build artifacts of whatever version
 * is installed, refreshed on every dev and build, so they can never drift from
 * the maplibre-gl in node_modules. They are gitignored for the same reason.
 */
import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];
const from = path.join(process.cwd(), "node_modules", "maplibre-gl", "dist");
const to = path.join(process.cwd(), "public", "maplibre");

if (!existsSync(from)) {
  console.warn("[maplibre] dist not found — skipping worker sync");
  process.exit(0);
}

await mkdir(to, { recursive: true });
for (const f of FILES) {
  // The worker imports the shared chunk by relative path, so both must land in
  // the same directory for the import to resolve.
  await copyFile(path.join(from, f), path.join(to, f));
}
console.log(`[maplibre] worker synced to public/maplibre (${FILES.join(", ")})`);
