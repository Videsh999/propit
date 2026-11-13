# PropIT

A map-first property discovery platform for Hyderabad.

> Most portals make you filter a list. PropIT asks where your life already is — your office, your
> child's school, your parents — and shows you the homes that sit between them.

```bash
npm install
npm run dev      # http://localhost:3000
```

**No API keys are needed.** The basemap, geocoding, POIs and the assistant all have working keyless
providers. Add keys to unlock better versions of the same features — never to make them work at all.

---

## The signature feature: Anchors & the Livable Zone

Open `/search`, hit **Anchors**, and drop the places that actually decide where you live:

```
📍 Office   Financial District   ≤ 6 km
📍 School   Oakridge Gachibowli  ≤ 5 km
   3 BHK · ₹1.4–2.2 Cr
```

PropIT intersects the reachable area of every anchor, paints the result on the map as a **Livable
Zone**, and ranks what's inside by a **Fit Score** you can click open:

```
fit   = Σ(wᵢ · sᵢ) / Σwᵢ            sᵢ = clamp(0, 1, 1 − dᵢ / limitᵢ)
final = 0.70·fit + 0.20·budgetFit + 0.10·typeMatch      → 0–100
```

Drag a pin and it recomputes. Prioritise one anchor over another and the weights shift.

**Zero results is never a dead end.** When nothing satisfies every constraint, PropIT works out the
smallest change that unlocks the most inventory and offers exactly that, with the real number —
escalating from "stretch one anchor" through to "relax several constraints" until it finds a route.

---

## Honesty rules

Real estate runs on numbers that are easy to assert and hard to check, so these are enforced in code:

- **Every figure is tagged** `verified` · `listed` · `estimated`, and each renders differently.
- **The assistant may never author a number.** It reasons, compares and recommends, but any price,
  area, RERA number or possession date must come from a tool result. If it isn't in the data, the
  assistant says so. (`src/lib/ai/tools.ts` → `systemPrompt`.)
- **Travel times are labelled as estimates** until a routing provider is connected. The dev provider
  derives them from straight-line distance × 1.35, and every consumer reads `leg.estimated` and
  labels accordingly. An estimate is never dressed as a measurement.
- **Locality economics are modelled**, not transaction records, and say so wherever they appear.

---

## The basemap

PropIT falls through a chain of providers, none of which need an API key:

```
OpenFreeMap (vector)  →  Esri Light Gray (raster)  →  OpenStreetMap (raster)
```

**CARTO is deliberately absent.** As of 2026 their keyless raster tiles — Positron
and Voyager alike — come back stamped `API KEY REQUIRED` across the whole image.
A smoke check asserts no CARTO host is ever referenced.

OpenFreeMap leads because it is free, unwatermarked, and serves its style, sprites,
glyphs and tiles from **one origin**. That matters more than it sounds: the earlier
setup split those across `basemaps.cartocdn.com` and `tiles*.basemaps.cartocdn.com`,
so a network blocking only the tile host left MapLibre waiting forever on glyphs and
the map rendered *nothing* — not the basemap, and not PropIT's own overlays either.

Two safeguards exist for that class of failure. The upstream style is rewritten into
PropIT's palette with glyphs repointed at `public/fonts/`, so labels never depend on
a CDN. And a watchdog waits for a real tile to reach the canvas — not merely for
"loaded" — before it stops trying the next provider.

The **Outer Ring Road** is real OSM geometry (relation 5634923, `scripts/fetch-orr.mjs`),
served from `public/data/orr.json`. The map opens framed on that ring and is fenced to
the metro area, so it can never show a world view.

### Markers

Below zoom 12.5 the map pins **named areas with live counts** — `Kokapet 28` — placed
by screen-space collision so labels never overlap; anything that loses its slot falls
back to a count-only badge rather than disappearing. Above 12.5 those become individual
price chips, each backed by a dot layer that needs neither fonts nor generated images,
so a home is never invisible.

### If the map is blank

Open **`/map-check`**. It runs in your browser, on your network, and reports WebGL
support, whether each provider is reachable, whether fonts load, and whether a bare
MapLibre map paints — isolating a network problem from a PropIT one.

```bash
npm run check:map      # asserts every map feature is visible, not just drawn
npm run preview:map    # renders the real city view to a PNG, no browser needed
```

`check:map` exists because the map once rendered as a flat grey rectangle: the tiles
were fine, but roads sat at 1.17:1 contrast against land and water at 1.16:1. It fails
the build if any feature drops below its legibility threshold.

---

## Architecture

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| Styling | Tailwind CSS v4 + CSS custom properties |
| Motion | Framer Motion |
| Map | MapLibre GL JS via `react-map-gl` |
| State | Zustand (persisted) + two-way URL sync |
| Data fetching | TanStack Query |
| Validation | Zod at every API boundary |
| Assistant | Anthropic Messages API with tool use, plus a deterministic fallback |

### Data layer

Development runs on an **in-memory spatial store** with a uniform grid index
(`src/lib/data/store.ts`) — 886 homes, 40 real localities, 98 projects and 386 mapped places, all
generated deterministically from real Hyderabad coordinates and price bands.

`db/schema.sql` is the production path: PostGIS geography columns, GiST indexes, and the actual
queries (`ST_DWithin`, `ST_Intersection`, `ST_ClusterDBSCAN`) written out. Everything above
`src/lib/data/repository.ts` is storage-agnostic, so swapping to Postgres means reimplementing that
one module.

### Provider abstractions

Every network dependency sits behind an interface in `src/lib/providers/`, with a keyless dev
implementation and a production one selected by env var:

| Provider | Dev (no key) | Production |
|---|---|---|
| Basemap | Carto Positron, restyled in code | MapTiler |
| Geocoding | PropIT's own data + Photon (OSM) | Mapbox / Google |
| Routing | straight-line × 1.35, **labelled estimated** | OpenRouteService |
| Assistant | deterministic concierge over the same tools | Claude with tool use |

---

## Scripts

```bash
npm run dev         # dev server
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run smoke       # end-to-end check against a running dev server
npm run check:map   # basemap legibility thresholds
npm run clean:dupes # remove iCloud conflict copies (see Development notes)
npm run preview:map # render a real tile in the current palette to a PNG
```

`npm run smoke` exercises filters, radius, draw-area, the Livable Zone, relaxation, natural-language
search, locality intelligence, the assistant's tool calls, and every page. It exits non-zero on
failure.

---

## What the assistant can do

It doesn't sit beside the map — it drives it. Tools in `src/lib/ai/tools.ts`:

`search_properties` · `add_anchor` · `remove_anchor` · `compute_livable_zone` · `set_map_view` ·
`get_locality_intelligence` · `list_localities` · `get_nearby` · `compare_properties` ·
`estimate_emi`

Each returns facts to the model and **client actions** to the browser, so you watch the map respond
as it talks.

PropIT AI looks up facts when a question arrives. It reads the current project, property, locality or
comparison, and links answers to the PropIT records used. Official links cover TG RERA, Telangana
registration and land services, HMDA planning and Hyderabad Metro. These links guide users to the
official records. The assistant does not verify individual registrations, titles or approvals.

The catalog currently uses generated showcase data. Citywide live availability, transaction prices
and independent project verification require an authorized data feed. The local assistant supports
project and locality questions, comparisons and map search without a key. Set `ANTHROPIC_API_KEY`
for conversational tool use and `ANTHROPIC_MODEL` to override the default Sonnet model.

---

## Environment

Everything in `.env.example` is optional. Copy it to `.env.local` and fill in what you want:

```
ANTHROPIC_API_KEY=          # conversational assistant
NEXT_PUBLIC_MAP_PROVIDER=   # carto (default) | maptiler
NEXT_PUBLIC_MAPTILER_KEY=
GEOCODING_PROVIDER=         # photon (default) | local
ROUTING_PROVIDER=           # unset for estimates | ors
ORS_API_KEY=                # real driving times + isochrones
DATABASE_URL=               # PostGIS, for the production data layer
```

---

## Development notes

This project lives on an **iCloud-synced Desktop**. iCloud periodically writes conflict
copies (`routes.d 2.ts`) into `.next`, which break typecheck, and its sync daemon
competes for I/O — `tsc` was once taking 4m40s of wall clock for 6s of CPU.

`npm run typecheck` clears those copies first, and `.gitignore` excludes them. The
durable fix is to move the project out of `~/Desktop`, or exclude `node_modules` and
`.next` from iCloud.

---

## Status

Hyderabad is the launch geography, not a hard-coded assumption — the city is a row in a table.

The listings, projects and locality statistics in this repo are **development data**, generated to
demonstrate the product end to end against real geography. They are not live market inventory.

Not yet built: accounts and authentication, real listing publication and document verification,
payments, and the admin dashboard (the schema anticipates all of them).
