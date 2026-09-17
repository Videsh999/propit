/**
 * End-to-end smoke test against a running dev server.
 *
 *   npm run dev          # in one terminal
 *   npm run smoke        # in another
 *
 * Exercises the real APIs and every page. Exits non-zero on failure so it can
 * gate a deploy.
 */
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
let failures = 0;

const pass = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  failures++;
  console.log(`  ✗ ${msg}`);
};
const expect = (cond, msg) => (cond ? pass(msg) : fail(msg));

const get = async (p) => {
  const r = await fetch(BASE + p);
  return { status: r.status, json: r.ok ? await r.json() : null };
};
const post = async (p, body) => {
  const r = await fetch(BASE + p, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: r.ok ? await r.json() : null };
};

console.log("\nFILTERS");
const all = await get("/api/properties?type=buy&limit=1");
expect(all.json?.total > 500, `inventory loaded (${all.json?.total} homes)`);
const bhk3 = await get("/api/properties?type=buy&bhk=3&limit=1");
expect(bhk3.json.total > 0 && bhk3.json.total < all.json.total, `3 BHK narrows the set (${bhk3.json.total})`);
const budget = await get("/api/properties?type=buy&bhk=3&maxPrice=20000000&limit=1");
expect(budget.json.total <= bhk3.json.total, `budget narrows further (${budget.json.total})`);
const kokapet = await get("/api/properties?type=buy&locality=kokapet&limit=5");
expect(
  kokapet.json.items.every((i) => i.address.includes("Kokapet")),
  "locality filter returns only that locality",
);
const rent = await get("/api/properties?type=rent&limit=5");
expect(rent.json.items.every((i) => i.listingType === "rent" && i.rentMonthly), "rent listings carry a monthly rent");

console.log("\nMAP MARKERS");
// The map showing nothing is the failure mode that matters most, so assert
// that real markers reach it at every zoom the app uses.
for (const z of [10.3, 11, 12, 12.5, 13, 15]) {
  const r = await get(`/api/properties?type=buy&limit=1&zoom=${z}`);
  const drawsClusters = z < r.json.clusterMaxZoom && r.json.clusters.length > 0;
  const markers = drawsClusters ? r.json.clusters.length : r.json.points.length;
  expect(markers > 0, `z${z} puts ${markers} ${drawsClusters ? "clusters" : "price chips"} on the map`);
}
const anchored = await get(
  `/api/properties?type=buy&limit=1&zoom=11&anchors=${encodeURIComponent(
    JSON.stringify([
      { id: "a1", label: "Office", kind: "office", location: { lat: 17.4155, lng: 78.341 }, address: "FD", maxKm: 6, weight: 1 },
    ]),
  )}`,
);
expect(
  anchored.json.points.length === anchored.json.total,
  `every home in an anchored search is on the map (${anchored.json.points.length}/${anchored.json.total})`,
);
expect(
  anchored.json.points.every((p) => p.lat > 17 && p.lat < 18 && p.lng > 78 && p.lng < 79),
  "every marker carries real Hyderabad coordinates",
);

// Named areas with counts are what the map shows at city zoom.
const areas = await get("/api/properties?type=buy&limit=1&zoom=11");
const areaSum = areas.json.localityCounts.reduce((n, l) => n + l.count, 0);
expect(
  areas.json.localityCounts.length > 20,
  `${areas.json.localityCounts.length} named areas pinned with counts`,
);
expect(areaSum === areas.json.total, `area counts sum to the total (${areaSum}/${areas.json.total})`);
expect(
  areas.json.localityCounts.every((l) => l.name && l.count > 0 && l.minPrice > 0),
  "every area pin carries a name, a count and a real starting price",
);
const filteredAreas = await get("/api/properties?type=buy&bhk=3&maxPrice=20000000&limit=1&zoom=11");
const fSum = filteredAreas.json.localityCounts.reduce((n, l) => n + l.count, 0);
expect(
  fSum === filteredAreas.json.total && fSum < areaSum,
  `area counts follow the filters (${fSum} homes across ${filteredAreas.json.localityCounts.length} areas)`,
);

const orr = await fetch(BASE + "/data/orr.json");
const orrJson = await orr.json();
expect(
  orr.status === 200 && orrJson.features?.[0]?.geometry?.coordinates?.length > 500,
  `ORR geometry served (${orrJson.features?.[0]?.geometry?.coordinates?.length ?? 0} segments)`,
);
const glyph = await fetch(BASE + "/fonts/Open%20Sans%20Regular/0-255.pbf");
expect(glyph.status === 200, "map fonts served locally, not from a CDN");

// CARTO's keyless raster tiles come back stamped "API KEY REQUIRED", so the
// basemap must never fall back to them.
const home = await (await fetch(BASE + "/")).text();
expect(!/basemaps\.cartocdn\.com/.test(home), "no CARTO basemap referenced (their free tiles are watermarked)");

try {
  const style = await fetch("https://tiles.openfreemap.org/styles/positron", {
    signal: AbortSignal.timeout(15000),
  });
  expect(style.ok, `primary basemap style reachable (HTTP ${style.status})`);
} catch {
  console.log("  … primary basemap unreachable from here; the app falls back to Esri, then OSM");
}

console.log("\nGEOSPATIAL");
const r3 = await get("/api/properties?type=buy&lat=17.4483&lng=78.3915&radiusKm=3&limit=1");
const r10 = await get("/api/properties?type=buy&lat=17.4483&lng=78.3915&radiusKm=10&limit=1");
expect(r3.json.total < r10.json.total, `radius scales results (3km=${r3.json.total}, 10km=${r10.json.total})`);
const poly = [[78.3, 17.38], [78.38, 17.38], [78.38, 17.46], [78.3, 17.46], [78.3, 17.38]];
const drawn = await get(`/api/properties?type=buy&limit=50&polygon=${encodeURIComponent(JSON.stringify(poly))}`);
expect(
  drawn.json.items.every(
    (i) => i.location.lng >= 78.3 && i.location.lng <= 78.38 && i.location.lat >= 17.38 && i.location.lat <= 17.46,
  ),
  `draw-area returns only points inside the polygon (${drawn.json.total})`,
);
const badPoly = await get("/api/properties?type=buy&limit=1&polygon=notjson");
expect(badPoly.status === 200, "malformed polygon degrades instead of erroring");

console.log("\nLIVABLE ZONE");
const office = { id: "a1", label: "Office", kind: "office", location: { lat: 17.4155, lng: 78.341 }, address: "FD", maxKm: 6, weight: 1 };
const school = { id: "a2", label: "School", kind: "school", location: { lat: 17.4419, lng: 78.3341 }, address: "Oakridge", maxKm: 5, weight: 1 };
const one = await post("/api/properties/zone", { anchors: [office], filters: { listingType: "buy" } });
const two = await post("/api/properties/zone", { anchors: [office, school], filters: { listingType: "buy" } });
expect(two.json.total < one.json.total, `second anchor tightens the zone (${one.json.total} → ${two.json.total})`);
expect(two.json.zone?.length > 8, "zone polygon is drawn");
expect(two.json.localityBreakdown.length > 0, `best-fit localities ranked (${two.json.localityBreakdown[0]?.name})`);
expect(two.json.items[0]?.fitScore > 0 && two.json.items[0].fitBreakdown.length === 2, "fit score explains itself per anchor");

const impossible = await post("/api/properties/zone", {
  anchors: [{ ...office, maxKm: 1 }],
  filters: { listingType: "buy", bedrooms: [5], propertyTypes: ["farmhouse"], priceMax: 3000000 },
});
expect(impossible.json.total === 0, "impossible query returns nothing");
expect(impossible.json.relaxations.length > 0, `zero results still offers a way forward ("${impossible.json.relaxations[0]?.label}")`);

console.log("\nSEARCH");
const sug = await get("/api/search/suggest?q=kok");
expect(sug.json.suggestions.some((s) => s.group === "Localities" && s.label === "Kokapet"), "autocomplete finds localities");
const nl1 = await post("/api/search/natural", { query: "3 BHK under 2 crore in Kokapet", context: {} });
expect(nl1.json.intent === "filter_query" && nl1.json.parsed.filters.bedrooms?.[0] === 3, "natural language parses bedrooms + budget + locality");
const nl2 = await post("/api/search/natural", { query: "apartment within 3 km of Hitech City", context: {} });
expect(nl2.json.parsed.radiusKm === 3 && nl2.json.parsed.target?.name === "Hitech City", "distance queries resolve a real target");
const nl3 = await post("/api/search/natural", { query: "which area is best for investment?", context: {} });
expect(nl3.json.intent === "question", "questions route to the assistant, not the filters");

console.log("\nLOCALITY INTELLIGENCE");
const intel = await get("/api/localities/kokapet/intelligence");
expect(intel.json.stats.inventory > 0 && intel.json.stats.avgPriceSqft > 0, "locality stats present");
expect(intel.json.nearby.length > 0 && intel.json.connectivity.length > 0, "nearby + connectivity resolved");
expect((await get("/api/localities/atlantis/intelligence")).status === 404, "unknown locality 404s cleanly");

console.log("\nASSISTANT");
const chat = await fetch(BASE + "/api/ai/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: [{ role: "user", content: "My office is in Financial District" }],
    context: { filters: { listingType: "buy" }, anchors: [] },
  }),
});
const stream = await chat.text();
const events = stream
  .split("\n\n")
  .filter((l) => l.startsWith("data:"))
  .map((l) => { try { return JSON.parse(l.slice(5)); } catch { return null; } })
  .filter(Boolean);
expect(chat.status === 200, "assistant streams a response");
expect(events.some((e) => e.type === "action" && e.action.type === "add_anchor"), "assistant places an anchor on the map");
expect(events.some((e) => e.type === "text"), "assistant returns prose");

console.log("\nRENT VS BUY");
const rvb = await get("/api/insights/rent-vs-buy?bedrooms=3");
expect(rvb.status === 200 && rvb.json.corridors.length > 0, "corridor medians resolve");
expect(
  rvb.json.corridors.every((c) => c.medianPrice > 0 && c.medianRent > 0),
  "every corridor has both a price and a rent",
);
// Hyderabad gross yields run roughly 2-5%. A figure outside that band means the
// rent and the price stopped describing the same kind of home — which is how a
// thin-sample median or a unit mix-up shows up.
const yields = rvb.json.corridors.map((c) => c.grossYieldPct);
expect(
  Math.min(...yields) > 1.5 && Math.max(...yields) < 6,
  `implied yields stay plausible (${Math.min(...yields).toFixed(1)}-${Math.max(...yields).toFixed(1)}%)`,
);
expect(
  rvb.json.corridors.every((c) => ["locality", "corridor", "modelled"].includes(c.rentBasis)),
  "every rent figure declares its basis",
);
const rvbBad = await get("/api/insights/rent-vs-buy?bedrooms=99");
expect(rvbBad.status === 400, "an unsupported configuration is rejected");

console.log("\nPAGES");
const pages = [
  ["/", "Find where"],
  ["/search", "PropIT"],
  ["/projects", "Projects"],
  ["/localities", "Kokapet"],
  ["/locality/kokapet", "PropIT estimate"],
  ["/sell", "Put it exactly where it is"],
  ["/about", "verified"],
  ["/profile", "Everything you"],
  ["/compare", "PropIT"],
  ["/sitemap.xml", "locality/kokapet"],
  ["/robots.txt", "Sitemap"],
];
for (const [path, needle] of pages) {
  const r = await fetch(BASE + path);
  const html = await r.text();
  expect(r.status === 200 && html.includes(needle), `${path} renders`);
}
const first = (await get("/api/properties?type=buy&limit=1")).json.items[0];
const detail = await (await fetch(`${BASE}/property/${first.slug}`)).text();
expect(detail.includes("Estimated EMI") && detail.includes("nearby"), "property detail renders fully server-side");
expect((await fetch(BASE + "/property/nope")).status === 404, "unknown property 404s");

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}\n`);
process.exit(failures === 0 ? 0 : 1);
