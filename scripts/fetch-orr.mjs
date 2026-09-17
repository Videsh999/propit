/**
 * Fetches the real Outer Ring Road geometry from OpenStreetMap and writes it to
 * src/lib/data/orr.json.
 *
 * The ORR is Hyderabad's defining geographic anchor — every buyer thinks in
 * "inside the ORR" / "on the ORR" terms. Drawing an approximate circle would be
 * a lie about geography, so we use the real relation.
 *
 *   node scripts/fetch-orr.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";

/**
 * Find the ORR by tag inside Hyderabad's bounding box rather than by a
 * hard-coded relation id, so the script survives OSM re-ids and re-splits.
 */
const QUERY = `
[out:json][timeout:120];
(
  rel["type"="route"]["ref"~"^ORR$",i](17.0,78.0,17.8,78.9);
  rel["type"="route"]["name"~"Outer Ring Road",i](17.0,78.0,17.8,78.9);
);
out geom;
`;

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchOrr() {
  let lastErr;
  // Overpass mirrors rate-limit aggressively; back off rather than give up.
  for (let round = 0; round < 3; round++) {
    for (const url of ENDPOINTS) {
      try {
        console.log(`querying ${new URL(url).host}…`);
        const res = await fetch(url, {
          method: "POST",
          body: "data=" + encodeURIComponent(QUERY),
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "propit-dev/1.0 (one-off ORR geometry fetch)",
          },
          signal: AbortSignal.timeout(120000),
        });
        if (res.status === 429 || res.status === 504) throw new Error(`HTTP ${res.status} (busy)`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json.elements?.length) throw new Error("empty result");
        return json;
      } catch (e) {
        lastErr = e;
        console.log(`  ${e.message}`);
      }
    }
    const wait = 4000 * (round + 1);
    console.log(`  all mirrors busy — waiting ${wait / 1000}s`);
    await sleep(wait);
  }
  throw lastErr;
}

const json = await fetchOrr();
const rels = json.elements.filter((e) => e.type === "relation" && Array.isArray(e.members));
if (!rels.length) throw new Error("no ORR relation in Overpass response");
for (const r of rels) {
  console.log(`relation ${r.id}: ${r.tags?.name ?? "(unnamed)"} · ref ${r.tags?.ref ?? "—"} · ${r.members.length} members`);
}
const rel = rels[0];

// Each member way carries its own geometry; keep them as separate line strings
// so the carriageways render as the real dual-carriageway loop.
const seen = new Set();
const lines = rels
  .flatMap((r) => r.members)
  .filter((m) => {
    if (m.type !== "way" || !Array.isArray(m.geometry) || m.geometry.length < 2) return false;
    if (seen.has(m.ref)) return false;
    seen.add(m.ref);
    return true;
  })
  .map((m) => m.geometry.map((p) => [Number(p.lon.toFixed(4)), Number(p.lat.toFixed(4))]));

// Douglas-Peucker: the ORR is ~158 km of dense nodes; we only need its shape.
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const sqTol = tolerance * tolerance;
  const sqSegDist = (p, a, b) => {
    let [x, y] = a;
    let dx = b[0] - x;
    let dy = b[1] - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) [x, y] = b;
      else if (t > 0) { x += dx * t; y += dy * t; }
    }
    dx = p[0] - x;
    dy = p[1] - y;
    return dx * dx + dy * dy;
  };
  const step = (pts, first, last, out) => {
    let maxSq = sqTol;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const sq = sqSegDist(pts[i], pts[first], pts[last]);
      if (sq > maxSq) { index = i; maxSq = sq; }
    }
    if (index === -1) return;
    if (index - first > 1) step(pts, first, index, out);
    out.push(pts[index]);
    if (last - index > 1) step(pts, index, last, out);
  };
  const out = [points[0]];
  const mid = [];
  step(points, 0, points.length - 1, mid);
  mid.sort((a, b) => points.indexOf(a) - points.indexOf(b));
  out.push(...mid, points[points.length - 1]);
  return out;
}

// ~65 m tolerance: keeps the ring's true shape at every zoom the app uses,
// without shipping 158 km of survey-grade nodes to the browser.
const simplified = lines.map((l) => simplify(l, 0.0006)).filter((l) => l.length > 1);
const nodesBefore = lines.reduce((n, l) => n + l.length, 0);
const nodesAfter = simplified.reduce((n, l) => n + l.length, 0);

let west = 180, south = 90, east = -180, north = -90;
for (const l of simplified)
  for (const [lng, lat] of l) {
    west = Math.min(west, lng); east = Math.max(east, lng);
    south = Math.min(south, lat); north = Math.max(north, lat);
  }

const geojson = {
  type: "FeatureCollection",
  properties: {
    name: rel.tags?.name ?? "Outer Ring Road",
    ref: rel.tags?.ref ?? "ORR",
    source: "OpenStreetMap contributors (ODbL)",
    osmRelation: rel.id,
    bbox: [west, south, east, north],
  },
  // One MultiLineString rather than a thousand features — far less parsing and
  // a single draw call for the map.
  features: [
    {
      type: "Feature",
      properties: { ref: rel.tags?.ref ?? "ORR" },
      geometry: { type: "MultiLineString", coordinates: simplified },
    },
  ],
};

// Served as a static asset rather than imported: keeping 2,000 coordinate
// pairs out of the TS program avoids a very expensive literal-type inference,
// and out of the JS bundle avoids shipping them on first paint.
mkdirSync("public/data", { recursive: true });
writeFileSync("public/data/orr.json", JSON.stringify(geojson));
console.log(`ways: ${simplified.length} | nodes ${nodesBefore} → ${nodesAfter}`);
console.log(`bbox: W${west.toFixed(3)} S${south.toFixed(3)} E${east.toFixed(3)} N${north.toFixed(3)}`);
console.log(`wrote public/data/orr.json (${(JSON.stringify(geojson).length / 1024).toFixed(0)} KB)`);
