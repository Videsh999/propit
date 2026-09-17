# PropIT — Master Build Prompt

> **How to use this:** Paste this whole document into Claude Code as your first message in an empty
> project directory. It is **phase-gated on purpose** — Claude should build Phase 0→3, stop, run the
> app, show you, and wait. Then you say "continue to Phase 4." Do not ask for all ten phases in one
> shot; the result will be shallow everywhere instead of excellent anywhere.

---

## 0. WHO YOU ARE, WHAT WE'RE BUILDING

You are acting as product designer, design engineer, geospatial engineer and AI product architect on
a single team. You are building **PropIT** (Sanskrit *निवास* — dwelling, abode, the place one belongs)
— a map-first real-estate discovery platform. Launch geography: **Hyderabad, India**. Architecture
must be city-agnostic from day one.

This is a **real implementation**, not a design concept and not a clickable mock. Every control you
render must be wired to real state and real queries, or must not exist yet.

### The one-sentence product

> Most portals make you filter a list. PropIT asks you where your life already is — your office, your
> child's school, your parents — and shows you the places you could live that hold all of it together.

### The signature feature (build the product around this, not around listings)

**Anchors & the Livable Zone.** The user drops points on the map that matter to their actual life:

```
📍 Office      Financial District     ≤ 20 min drive
📍 School      Oakridge, Gachibowli   ≤ 5 km
📍 Parents     Kompally               ≤ weekend distance
   Budget      ₹1.4 – 2.2 Cr   ·   3 BHK   ·   Apartment or Villa
```

PropIT computes the geographic region that satisfies all of them, paints it on the map as a soft
**Livable Zone**, and ranks the properties inside it by a transparent **Fit Score**. The user then
drags a radius, moves an anchor, or tells the assistant *"prioritise the office over the school"* —
and the zone recomputes live.

If nothing satisfies every constraint, PropIT **never** shows an empty state. It relaxes the weakest
constraint and says exactly what it did:

> No home matches all four. Stretching the school from 5 km to 7 km opens up **41 homes** in Nallagandla
> and Tellapur — your office commute stays under 20 minutes. *[Apply]* *[Try something else]*

Everything else in this document exists to support that moment.

---

## 1. NON-NEGOTIABLE RULES

1. **No mock interactions.** If a button is on screen, it changes real state and issues a real query.
   A control you cannot yet wire does not get rendered. No `onClick={() => {}}`, no `alert()`, no
   "coming soon."
2. **No invented facts.** Prices, RERA numbers, possession dates, availability and area figures come
   from the database only. The AI assistant may reason, compare and recommend; it may never author a
   number. Every surfaced figure is tagged `verified | listed | estimated` and rendered differently.
3. **The map is the product**, not a section of a landing page. If the map ever feels like an embedded
   widget, the design has failed.
4. **Server-side geospatial.** PostGIS does the distance work. Never ship thousands of coordinates to
   the browser to loop over them.
5. **It runs on first `npm run dev` with zero API keys.** Basemap, geocoding, POIs and routing all have
   working keyless dev providers behind interfaces (§5). Paid providers are swap-in upgrades, never
   prerequisites.
6. **Do not build a rounded-card website.** See §3.

---

## 2. STACK

| Layer | Choice | Note |
|---|---|---|
| Framework | **Next.js 15**, App Router, TypeScript strict | Server Components by default; `"use client"` only where interactivity demands it |
| Styling | **Tailwind CSS v4** + CSS custom properties for tokens | Tokens in CSS vars so the map style and the UI share one palette |
| Motion | **Framer Motion** | |
| Map | **MapLibre GL JS** (`react-map-gl/maplibre`) | Not Mapbox — no token required, same API surface |
| State | **Zustand** (one `useDiscoveryStore`) + **nuqs** for URL sync | Every search state is a shareable URL |
| Data | **TanStack Query** | |
| DB | **PostgreSQL 16 + PostGIS 3.4** | `docker-compose.yml` in repo |
| ORM | **Drizzle ORM** | Hand-write the PostGIS bits in SQL; Drizzle for the rest |
| Search | Postgres `pg_trgm` + `tsvector` | Elasticsearch is a later swap, not now |
| AI | Anthropic Messages API, `claude-sonnet-5`, tool use | Streaming, tools defined in §8 |
| Validation | **Zod** at every API boundary | |
| Tests | Vitest (units, scoring, parser) + Playwright (the journey in §11) | |

Everything a network call touches lives behind an interface in `src/lib/providers/`. No provider SDK
is imported outside that folder.

---

## 3. DESIGN LANGUAGE — "WARM EDITORIAL"

The reference is not a real-estate portal. It is a well-set architecture monograph: warm paper, real
photography, confident type, enormous restraint. Apple's discipline, not Apple's chrome.

### Tokens — implement these literally in `globals.css`

```css
:root {
  /* surfaces — warm paper, never pure white, never cool grey */
  --paper:        #FBFAF7;
  --paper-raised: #FFFFFF;
  --paper-sunk:   #F4F2ED;
  --line:         #E5E1D8;   /* hairlines carry the layout, not shadows */

  /* ink */
  --ink:          #17150F;
  --ink-muted:    #6A6459;
  --ink-faint:    #9A9488;

  /* one accent. deep pine — used for actions and the livable zone */
  --accent:       #1E4A3C;
  --accent-hover: #16382D;
  --accent-wash:  #1E4A3C14;

  /* data accents — map + charts ONLY, never for UI chrome */
  --data-brass:   #B0763C;   /* anchors */
  --data-clay:    #A44A32;   /* price heat: high */
  --data-sage:    #7C8C6A;   /* price heat: low */

  /* elevation — two levels, that's all */
  --e1: 0 1px 2px #17150F0A, 0 0 0 1px #17150F0D;
  --e2: 0 8px 32px -8px #17150F1F, 0 0 0 1px #17150F0F;

  /* radii — small. deliberately. */
  --r-sm: 4px; --r-md: 8px; --r-lg: 14px;   /* nothing above 14px except the map canvas (20px) */

  /* motion */
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --t-micro: 160ms; --t-panel: 320ms; --t-map: 700ms;
}
```

Dark mode: redefine tokens only. `--paper: #14130F`, `--ink: #F2EFE8`, warm not blue-black.

### Type

- Display / headlines: **Fraunces** (variable, `opsz` axis, `wght` 300–500, slight optical size at
  large sizes). Serif. This alone separates PropIT from every blue-sans portal.
- UI / body / data: **Inter** with `font-feature-settings: "ss03","cv05","tnum"`. Tabular numerals on
  every price — non-negotiable, prices must not jitter.
- Scale: 12 / 13 / 15 / 17 / 21 / 28 / 40 / 56 / 76. Tight tracking on display (`-0.03em`), normal on body.
- Hero headline: Fraunces 300, 56–76px, max 14 words, no gradient text, ever.

### Layout

- 8px base grid. Content max-width 1440px, gutters 32px desktop / 20px mobile.
- Section rhythm below the fold: **128px** vertical. Generosity is the luxury signal, not decoration.
- Hairline `--line` borders do the structural work. Shadows are reserved for things that genuinely
  float above the map.

### Explicitly forbidden

Gradient buttons · glassmorphism beyond one blurred nav · `rounded-2xl` on every div · drop shadows on
static content · emoji as UI iconography · stock "happy family" photography · badge soup on cards ·
skeuomorphic map pins · more than one accent hue in the chrome · any element that animates without a
state change behind it · text over busy photos without a scrim · centre-aligned body copy.

### Icons

Lucide, 1.5px stroke, 18px default. Never mix icon families.

---

## 4. THE MAP

### Style

Default basemap: Carto **Positron** vector style
(`https://basemaps.cartocdn.com/gl/positron-gl-style/style.json`) — keyless, works immediately.
Then **restyle it in code** at runtime so it belongs to PropIT rather than looking like a default:

- desaturate landuse toward `--paper-sunk`
- water → a single muted slate, no blue saturation
- roads → hairline `--line`, motorways one step darker, no colour coding
- labels → Inter, `--ink-muted`, drop POI labels below zoom 14 entirely
- kill every stock POI icon; PropIT draws its own POI layer

Ship this as `src/lib/map/propitStyle.ts` — a function that takes the base style JSON and returns the
PropIT-tuned style. Include a dark variant.

### Layers (all GeoJSON sources, all WebGL — no DOM markers except the selected one)

| Layer | Render | Zoom |
|---|---|---|
| Locality boundaries | fill 6% accent + 1px line, label at centroid | ≤ 13 |
| Price heat | locality fill interpolated `--data-sage → --data-clay` by ₹/sq.ft | toggle |
| Clusters | circle + count, radius interpolated by point count | ≤ 14 |
| Property markers | **price chips** (`₹1.42 Cr`) as symbol layer w/ SDF background | ≥ 14 |
| Livable Zone | fill `--accent` @ 10%, animated dashed outline | when anchors ≥ 1 |
| Anchor pins | `--data-brass`, labelled, draggable | when anchors ≥ 1 |
| Radius rings | line + faint fill, live-updating label showing km | when radius active |
| POIs | small glyphs, per-category toggle | on demand |
| Drawn shapes | user polygon/circle/rect | on demand |

Price chips, not pins. `₹1.42 Cr` in tabular Inter on a white pill with a hairline border. Hover:
scale 1.04 + shadow. Selected: fill `--ink`, white text. Viewed already: `--ink-faint` text.

### Interaction contract

- Pan/zoom → debounced 350ms → refetch by bounds → results list updates → **"Search this area"**
  button appears only when bounds drifted materially.
- Click cluster → `easeTo` its bounds, 700ms, `--ease`.
- Click property → map `flyTo` offset so the card doesn't cover the marker → preview card animates
  *out of* the marker position (shared-layout, not a modal fade).
- Click locality → Locality Intelligence panel (§7), boundary highlights, results scope to it.
- Escape → collapse the deepest open surface, one level at a time.
- `prefers-reduced-motion` → `jumpTo` instead of `flyTo`, no marker scale.

### Performance budget (test these, don't assume)

- 60fps sustained pan at 2,000 properties in viewport
- Bounds query p95 **< 200ms** server-side
- Never more than **300 features** hydrated client-side; clustering happens in Postgres via
  `ST_ClusterDBSCAN` above the DOM threshold
- Map paints before data. Always. Skeleton chips, never a spinner over the canvas.

---

## 5. PROVIDER ABSTRACTIONS

`src/lib/providers/` — each is an interface + a keyless dev impl + a production impl selected by env.

```ts
interface BasemapProvider   { styleUrl(theme): string }              // carto (dev) | maptiler | mapbox
interface GeocodingProvider { search(q, near?): Promise<Place[]> }   // photon.komoot.io (dev) | mapbox | google
interface PoiProvider       { nearby(point, categories, radiusM): Promise<Poi[]> }  // local PostGIS seed (dev) | overpass | google places
interface RoutingProvider   { matrix(origins, dests, mode): Promise<Leg[]>          // haversine×1.35 @ 24km/h (dev, LABELLED ESTIMATED) | osrm | ors | google
                              isochrone(point, minutes, mode): Promise<Polygon | null> }
interface LlmProvider       { stream(msgs, tools): AsyncIterable<Chunk> }
```

**The dev routing fallback must be visibly honest.** Any travel time it produces renders as
`~18 min · estimated` with the word estimated in `--ink-faint`, and a tooltip explaining it is a
straight-line approximation. When a real routing key is present, the label becomes `18 min · driving`.
`isochrone()` returns `null` in dev; the Livable Zone then falls back to distance buffers, and the UI
says "distance-based" rather than "commute-based." **Never dress an estimate as a measurement.**

Env (`.env.example`, never hard-code):
`DATABASE_URL` · `ANTHROPIC_API_KEY` · `NEXT_PUBLIC_MAP_PROVIDER` · `NEXT_PUBLIC_MAPTILER_KEY` ·
`GEOCODING_PROVIDER` · `ROUTING_PROVIDER` · `ORS_API_KEY`

---

## 6. DATA MODEL

PostGIS `geography(Point,4326)` for anything positional, `geography(MultiPolygon,4326)` for localities.
GiST index on every geometry column. This is the spine — get it right before any UI.

```
cities            id, name, slug, center geography(Point), bbox, timezone
localities        id, city_id, name, slug, boundary geography(MultiPolygon), center geography(Point),
                  avg_price_sqft, median_price, rental_yield_pct, inventory_count, momentum_pct,
                  summary, hero_image_url
developers        id, name, slug, logo_url, established_year, projects_delivered, rera_registered, about
projects          id, developer_id, locality_id, name, slug, location geography(Point),
                  status(new_launch|under_construction|ready|upcoming), possession_date,
                  rera_number, rera_verified bool, price_min, price_max, units_total, units_available,
                  land_area_acres, towers, floors, description, hero_image_url, brochure_url
properties        id, project_id?, locality_id, listing_type(buy|rent), property_type,
                  location geography(Point), address, title, slug,
                  price, price_per_sqft, rent_monthly, deposit, maintenance_monthly,
                  carpet_area_sqft, builtup_area_sqft, bedrooms, bathrooms, balconies, parking,
                  floor, total_floors, facing, furnishing, age_years, availability_date,
                  data_quality(verified|listed|estimated), is_verified, rera_number,
                  view_count, created_at, updated_at
property_images   id, property_id, url, blurhash, width, height, sort_order, room_tag
amenities         id, name, slug, category, icon
property_amenities / project_amenities   (join)
pois              id, city_id, name, category(metro|school|hospital|office_hub|mall|park|
                  stadium|airport|railway|restaurant|gym|temple), location geography(Point),
                  subcategory, rating, verified
price_history     id, property_id|locality_id, period, price_per_sqft, source
users             id, email, name, avatar_url, phone, created_at
user_anchors      id, user_id, label, kind(office|school|family|gym|other),
                  location geography(Point), address, max_minutes?, max_km?, weight numeric default 1
saved_properties / saved_projects / recently_viewed
saved_searches    id, user_id, name, filters jsonb, anchors jsonb, created_at, alert_enabled
comparisons       id, user_id, property_ids[]
enquiries         id, user_id, property_id, type(callback|visit|message), message, status, scheduled_at
ai_conversations  id, user_id, title, created_at
ai_messages       id, conversation_id, role, content jsonb, tool_calls jsonb, created_at
analytics_events  id, user_id?, session_id, name, props jsonb, created_at
```

### Seed data — geographically real, not random

Seed **~40 localities**, **~60 projects**, **~900 properties**, **~250 POIs** using real coordinates.
Properties must sit inside their locality's boundary and cluster along real corridors (ORR, the
Gachibowli–Financial District belt, the Kompally and Tellapur growth corridors) — not scattered
uniformly, which instantly looks fake on a map.

Real anchor coordinates to build from:

```
Kokapet 17.4085,78.3283 · Financial District 17.4155,78.3410 · Nanakramguda 17.4200,78.3450
Gachibowli 17.4401,78.3489 · Madhapur 17.4485,78.3908 · Hitech City 17.4483,78.3915
Kondapur 17.4615,78.3640 · Nallagandla 17.4737,78.3092 · Tellapur 17.4890,78.2870
Kollur 17.4980,78.2600 · Narsingi 17.3925,78.3420 · Manikonda 17.4048,78.3772
Jubilee Hills 17.4326,78.4071 · Banjara Hills 17.4126,78.4448 · Ameerpet 17.4374,78.4487
Begumpet 17.4435,78.4645 · Secunderabad 17.4399,78.4983 · Kukatpally 17.4948,78.3996
Miyapur 17.4960,78.3580 · Bachupally 17.5460,78.3810 · Kompally 17.5400,78.4870
Uppal 17.4056,78.5590 · Pocharam 17.4300,78.6200 · Adibatla 17.2330,78.5670
Attapur 17.3660,78.4270 · Shamshabad 17.2403,78.4294

POIs: RGIA Airport 17.2403,78.4294 · Raidurg Metro 17.4380,78.3830 · Hitec City MMTS 17.4490,78.3800
Rajiv Gandhi Intl Cricket Stadium (Uppal) 17.4064,78.5504 · Gachibowli Stadium 17.4310,78.3480
AIG Hospital Gachibowli 17.4340,78.3510 · Continental Hospitals 17.4180,78.3390
Inorbit Mall 17.4348,78.3860 · Sarath City Capital Mall 17.4620,78.3540 · IKEA 17.4245,78.3430
KBR Park 17.4180,78.4180 · Durgam Cheruvu 17.4400,78.3860 · Osman Sagar 17.3720,78.3140
```

Price realism matters as much as coordinate realism: Kokapet and Financial District ₹9,000–13,500/sq.ft,
Gachibowli ₹7,500–10,000, Jubilee Hills ₹14,000–22,000, Tellapur ₹6,200–7,800, Kompally ₹4,800–6,200,
Bachupally ₹4,500–5,800. Derive property prices from locality ₹/sq.ft × area with ±12% variance.

Images: use a small curated set of architectural photographs (Unsplash source URLs, attributed) mapped
consistently per project — the *same* project must always show the *same* images. Randomised imagery
per render destroys the premium feel instantly.

---

## 7. SURFACES TO BUILD

### 7.1 Navigation

`PropIT` wordmark (Fraunces, letterspaced) · Buy · Rent · Projects · Sell · Localities · About ·
`⌘K` search affordance · **Ask PropIT** · avatar.

At scroll > 80px: height 72→56px, `backdrop-filter: blur(20px) saturate(1.4)`, background
`color-mix(in srgb, var(--paper) 82%, transparent)`, hairline bottom border fades in. One blurred
surface in the whole product — this one.

### 7.2 Hero — map-first

Full-bleed, `height: calc(100svh - 72px)`, `max-height: 880px`. Never taller than the viewport.

- **Left 60%:** live MapLibre canvas, `--r-lg` corners on the outer container, inset 24px from the
  page edge, `--e2`. Boots at Hyderabad bounds with clusters already rendered — the first thing the
  user sees is real inventory, not a placeholder.
- **Right 40%:** the search surface. Not a filter form — a *conversation opener*.

```
      Find where your life fits.
      Tell PropIT the places that matter. It will find the homes between them.

      [ Search a locality, project, or just describe what you want…        ⌘K ]

      ── or start with your anchors ──────────────────────────────────
      [+ My office]   [+ My child's school]   [+ Family]   [+ Anything]

      Buy · Rent · Projects              3 BHK ▾    ₹1 Cr – 2 Cr ▾
                                                    [ Show 428 homes → ]
      Popular   Kokapet · Financial District · Tellapur · Kompally
```

The `428` is a live count from the current filter state, animated with tabular numerals. It changes as
they touch anything. That single number is the proof the product is real.

`Expand map ⤢` sits bottom-right of the canvas.

### 7.3 Discovery — `/search`

Split view: map left, results right (`420px`, scroll-synced). Hovering a card lifts its marker;
hovering a marker lifts its card. Bidirectional, both directions, always.

Floating command bar over the map: `Search this area` · `Anchors` · `Radius` · `Draw` · `Nearby` ·
`Layers` · `List / Split / Map`.

State lives in the URL: `/search?city=hyderabad&type=buy&bhk=3&min=10000000&max=22000000&anchors=...&bounds=...`
Every search is copy-pasteable. This is a feature, not plumbing.

### 7.4 Anchors panel — the signature surface

Slides in from the left over the map, 380px, `--paper-raised`.

Per anchor: label, kind icon, geocoded address, a constraint control (minutes when routing is real,
km otherwise), a **weight slider** (`Nice to have ←→ Non-negotiable`), remove. Drag the pin on the map
and everything recomputes at 60fps with a 250ms debounce.

Below the anchors:

```
   Livable Zone            41 homes
   ─────────────────────────────────
   Best fit    Nallagandla   ·  14 homes  ·  ₹7,400/sq.ft avg
               Tellapur      ·  19 homes  ·  ₹6,900/sq.ft avg
               Kollur        ·   8 homes  ·  ₹6,400/sq.ft avg

   Prioritise:  ● Office   ○ School   ○ Balanced
```

**Fit Score** — show it on every card in the zone, and make it explainable on click:

```
fit = Σ(wᵢ · sᵢ) / Σwᵢ                 where sᵢ = clamp(0, 1, 1 − (dᵢ / limitᵢ))
final = 0.70·fit + 0.20·budgetFit + 0.10·typeMatch      → 0–100
```

Clicking the score opens: *"92 — Office 11 min (limit 20), School 3.1 km (limit 5), ₹1.68 Cr fits your
range."* No black boxes. Trust is the product.

**Zero-result relaxation** — mandatory, never an empty state. Compute which single constraint, when
loosened by the smallest amount, unlocks the most inventory. Offer exactly that, with the number.

### 7.5 Locality Intelligence panel

Triggered by clicking a locality. Slides from the right, 480px, over a dimmed-but-live map.

Hero photograph → name → one-line character line (*"Hyderabad's financial spine — glass towers,
new inventory, weekday energy"*) → then, progressively disclosed:

`₹9,800/sq.ft avg` · `428 homes` · `31 projects` · `3.2% yield` · `+11% YoY` — each with a data-quality
tag. Then a 5-year price sparkline, connectivity (metro/ORR/airport with real distances), **What's
Nearby** grouped by category with distances, top projects, and an investment read that is clearly
labelled analysis rather than fact.

Every nearby item is clickable → map draws the line to it, panel shows distance + estimated time.

### 7.6 Property preview & detail

**Preview** (from marker): 360px floating card, shared-layout animated out of the marker. Image,
title, locality, price + ₹/sq.ft, `3 BHK · 3 Bath · 1,850 sq.ft`, fit score if anchors active, verified
badge, three actions: `View` `Compare` `Save`.

**Detail** `/property/[slug]`: cinematic gallery (scroll-driven, not a carousel with dots) → sticky
price rail with EMI calculator → specs → floor plans → amenities → **What's Nearby** with a live map →
commute-from-your-anchors block → developer → RERA block → price history → similar homes. CTAs:
`Schedule visit` `Request callback` `Ask PropIT about this home`.

### 7.7 Home page below the hero

Featured Projects (editorial, large imagery, 3-up) → Popular Localities (map-thumbnail cards with live
counts) → **Explore by Lifestyle** (*Near your office · Great schools nearby · Metro-connected ·
Investment momentum · Quiet & green*) → Featured Homes → Locality Intelligence teaser → New Launches →
**Meet PropIT** (the assistant, shown doing something real) → Developers → footer.

128px rhythm. Alternate full-bleed and contained. Not nine identical card grids.

### 7.8 Also build

`/projects`, `/project/[slug]`, `/localities`, `/locality/[slug]`, `/sell` (listing wizard with real
validation + map placement), `/rent`, `/profile` (saved, searches, anchors, compare, enquiries, visits,
AI history), `/compare` (side-by-side + AI summary), `/about`.

### 7.9 Mobile

Map fills the screen. Results in a bottom sheet with three detents (12% / 55% / 92%), spring physics,
real drag. Search, Filters, Anchors and Ask PropIT as a floating pill row. Anchors panel becomes a
full-height sheet. This is a redesign, not a reflow.

---

## 8. SEARCH & THE ASSISTANT

### 8.1 Command palette (`⌘K`) and the hero input are the same component

Debounced 180ms, grouped results with keyboard navigation:

```
Localities   Kokapet · Kondapur · Kukatpally
Projects     My Home Apas · Rajapushpa Provincia
Developers   My Home Constructions
Nearby       Kokapet Junction · Kokapet Lake
Ask PropIT   "3 BHK under 2 Cr near Hitech City"     ← always the last row
```

### 8.2 Intent routing

`POST /api/search/natural` classifies into `filter_query` | `question` | `mixed`.

- `filter_query` → deterministic parser first (regex/grammar for `3 BHK`, `under 2 crore`, `within 3 km
  of X`, `near Y`, `villa`, `ready to move`). Cheap, instant, no LLM. LLM only when the parser's
  confidence is low.
- `question` → assistant answers, grounded in tool results.
- `mixed` → both: map updates *and* the assistant explains what it did.

### 8.3 Assistant tools — the AI must be able to drive the map

Define these as Anthropic tool definitions. The assistant's answer is rendered alongside the map
changing in real time.

```ts
set_filters({ listingType, propertyType[], bedrooms[], priceMin, priceMax, areaMin, areaMax,
              possession, amenities[], locality[] })
search_properties({ bounds?, center?, radiusKm?, filters, sort, limit })
add_anchor({ label, kind, query | latlng, maxMinutes?, maxKm?, weight? })
update_anchor({ id, ...partial })   remove_anchor({ id })
compute_livable_zone({ prioritise? })
set_map_view({ center?, zoom?, bounds?, localitySlug? })
draw_radius({ center | anchorId, km })
toggle_layer({ layer, on })
select_property({ id })             compare_properties({ ids[] })
get_locality_intelligence({ slug })
get_nearby({ propertyId | latlng, categories[], radiusKm })
estimate_emi({ price, downPaymentPct, ratePct, years })
```

**Grounding rules, enforced in the system prompt and in code:**
- Every factual claim traces to a tool result in this turn. No tool result → *"I don't have that."*
- Never state a price, RERA number, possession date or availability that isn't in a tool response.
- Distinguish `verified` / `listed` / `estimated` in prose, not just in badges.
- Recommendations are opinions and are phrased as such.
- The assistant is not a financial adviser; EMI output is illustrative and says so.

### 8.4 The assistant's presence

Not a bubble in the corner. A right-hand rail (`400px`) that slides in and **coexists with the map**,
so the user watches the map respond as it talks. Streaming text, tool calls rendered as quiet inline
status lines (`Placed your office in Financial District` · `Found 41 homes`), suggested follow-ups.
Conversations persist to `ai_conversations`.

Target dialogue:

> **You:** My office is in the Financial District and my son goes to Oakridge Gachibowli. 3 BHK under 2 crore.
>
> **PropIT:** Placed both. Within 20 minutes of your office and 5 km of the school, there are **41 homes**
> in your range — mostly Nallagandla, Tellapur and Kollur. Nallagandla is the strongest compromise:
> ₹7,400/sq.ft, 14 homes, and both trips stay under 15 minutes.
> *Travel times are estimated from distance until routing is connected.*
>
> Want me to prioritise the school run, or open it up to 2.4 Cr for newer inventory?

---

## 9. API SURFACE

```
GET  /api/properties?bounds=&lat=&lng=&radiusKm=&type=&bhk=&minPrice=&maxPrice=&
                     minArea=&maxArea=&possession=&amenities=&locality=&project=&
                     developer=&sort=&cursor=&limit=
POST /api/properties/zone          { anchors[], filters }  → { zone GeoJSON, properties[], scored }
GET  /api/properties/[slug]
GET  /api/localities?city= | /api/localities/[slug]
GET  /api/localities/[slug]/intelligence
GET  /api/projects | /api/projects/[slug]
GET  /api/search/suggest?q=
POST /api/search/natural           { query, context } → { intent, filters?, anchors?, answer? }
GET  /api/poi/nearby?lat=&lng=&categories=&radiusKm=
POST /api/routing/matrix           { origins[], destinations[], mode }
POST /api/ai/chat                  (streams; tool use)
POST /api/enquiries | /api/visits
GET/POST/DELETE /api/saved/*  /api/anchors  /api/searches
```

Every handler: Zod-validated input, cursor pagination, `Cache-Control` where safe, rate limiting on
`/api/ai/*` and `/api/search/natural`. Client filters are hints; **the server re-validates and
re-applies every constraint**.

Core spatial queries — write these by hand:

```sql
-- bounds
WHERE ST_Intersects(location, ST_MakeEnvelope($1,$2,$3,$4,4326)::geography)

-- radius
WHERE ST_DWithin(location, ST_MakePoint($lng,$lat)::geography, $radiusM)

-- livable zone (n anchors)
WITH zone AS (
  SELECT ST_Intersection( ... ST_Buffer(a.location, a.max_m) ... ) AS g FROM anchors a
)
SELECT p.* FROM properties p, zone WHERE ST_Within(p.location::geometry, zone.g::geometry)

-- server-side clustering above the DOM budget
SELECT ST_ClusterDBSCAN(location::geometry, eps := $eps, minpoints := 3) OVER () AS cid, ...
```

---

## 10. BUILD ORDER — STOP AT EACH GATE

Work phase by phase. **At the end of each phase: run the app, exercise it yourself in the browser,
fix every console and TypeScript error, then report to me with screenshots and wait.** Do not run ahead.

| Phase | Deliverable | Done when |
|---|---|---|
| **0** | Scaffold, docker-compose Postgres+PostGIS, Drizzle schema, migrations, seed script, `.env.example` | `npm run seed` loads 900 properties; a raw radius query returns sane results |
| **1** | Design system: tokens, type, Button/Input/Sheet/Panel/Card/Skeleton/Toast, nav, footer | A tokens page renders every component in light + dark |
| **2** | Map engine: MapLibre, PropIT style, clusters, price chips, bounds→query→results loop | Pan and zoom updates real results at 60fps |
| **3** | Hero + home page + `/search` split view, URL state, hover sync | The journey in §11 works up to "clicks a property" |
| **4** | Filters (all of §7.3), live counts, server-side re-validation | Every filter changes the number and the map |
| **5** | Radius, draw (circle/polygon/rect), "search this area", layers | Drawing returns only properties inside the shape |
| **6** | **Anchors, Livable Zone, Fit Score, relaxation** | The §11 journey, end to end, feels inevitable |
| **7** | Locality intelligence, property detail, project detail, nearby, commute | Panels are real data, progressively disclosed |
| **8** | Assistant: streaming, all tools, map control, grounding, persistence | It places anchors and moves the map from language alone |
| **9** | Auth, profile, saved searches/properties/anchors, compare, enquiries, sell wizard | State survives reload and is shareable by URL |
| **10** | Perf, a11y, SEO metadata + sitemap, analytics, Playwright, empty/error states everywhere | Lighthouse ≥ 92 all four, zero axe violations, journey test green |

---

## 11. THE JOURNEY THAT MUST WORK

This is the acceptance test. Write it as a Playwright spec.

1. Land. Map is live with clustered inventory within 1.5s. Hero count reads a real number.
2. Type *"3 BHK under 2 crore near Hitech City"*. Suggestions appear under 200ms.
3. Enter. Map flies to Hitech City, filters fill in visibly, count updates, results render.
4. Open Anchors. Add Office → Financial District. Add School → Oakridge Gachibowli, ≤ 5 km.
5. Livable Zone paints. Count drops. Top three localities are listed and ranked.
6. Drag the office pin 2 km east. Zone and count recompute under 400ms.
7. Set budget to ₹1.4–1.8 Cr. Zero results → **relaxation offer**, not an empty state. Apply it.
8. Click a price chip. Card animates from the marker. Fit score is shown and explains itself.
9. Open the property. Gallery, specs, nearby, commute-from-your-anchors all real.
10. Ask PropIT *"is this good for a family?"* — grounded answer citing schools, parks and hospitals
    that actually exist in `pois`.
11. *"Show me cheaper options nearby."* Map updates. Filters visibly change.
12. Compare three. AI summary that invents nothing.
13. Save the search. Reload. It's still there. Share the URL — it opens in the same state.
14. Repeat 1–8 at 390×844. Bottom sheet, detents, floating controls. Equally good.

---

## 12. FINAL BAR

Before you tell me a phase is done, ask yourself:

- Would this be mistaken for any existing property portal? → then redesign it.
- Does the map feel like the product, or like a widget? → widget means redesign.
- Can I discover a home by describing my life rather than by filtering a list? → if not, the signature
  feature isn't built.
- Does anything on screen animate, glow or badge without a real state behind it? → delete it.
- Is there a single number on screen the database didn't produce? → that's a bug, not a placeholder.
- Does it feel expensive — or does it feel like it's *trying* to? → restraint over decoration, always.

Build Phase 0 through Phase 3 now. Then stop, run it, screenshot it, and wait for me.
