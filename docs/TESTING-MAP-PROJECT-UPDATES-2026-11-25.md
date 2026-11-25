# Map and project update verification — 25 November 2026

## Scope

The flow is: landmark or map pin / multiple locality selection → shared discovery filters → validated property API → matching homes and map markers. Project pages add floating section navigation, configuration tabs, specifications, an inline brochure reader, developer profiles, and approved community updates.

## Automated checks

- Production build with Next.js 16.4.6: passed.
- TypeScript: passed. ESLint with zero warnings: passed.
- 26 tests: passed, including ground-floor URL serialization, invalid/reversed floor bounds, floor filtering, multiple locality union with budget/floor intersection, exact 500 m / 2 km / 3 km radius matching, moved-centre results, and sourced/approved community-update validation.
- 90 smoke assertions against the final local production build: passed, covering property APIs, geospatial markers, project sections, developer list/profile links, unknown-developer 404s, and existing application routes.
- HTTP/security acceptance: passed. Ordinary pages retain frame denial; brochure/plan PDF paths allow same-origin framing. Nonces, mutation origin checks, and AI burst protection passed.
- Local concurrent search sample: 100 requests, concurrency 10, zero errors; p50 14 ms, p95 26 ms, maximum 28 ms. These measure local server processing and do not predict public-network latency.
- Map contrast and local glyph-stack checks: passed. The tsx CLI could not open its sandbox IPC pipe, so the same script was run successfully using `node --import tsx`.

## Browser verification

- Added Kokapet and Gachibowli through the search suggestions; both removable chips remained selected. Budget numeric entry and keyboard slider committed correctly; floor 4–9 appeared in the linked search URL. Escape closed the advanced filters.
- Searched Wipro Circle; selected 500 m, 2 km and 3 km. The labelled centre pin and query radius matched. Dropped a new pin and dragged it; URL coordinates changed while preserving the distance. Escape cancelled placement. Radius keyboard control moved 3 km to 2.75 km. An unmatched origin + Enter stayed in the radius search without opening the assistant.
- The project menu stayed at 80 px from the viewport top and showed the project title. Links reached floor plans, inventory, specifications, brochure, amenities and developer. The 3 BHK inventory tab showed its two matching sale listings. The floor-plan tab clearly showed that the builder plan was not supplied.
- Brochure brief rendered inline without a download button; developer profile and directory links opened correctly. Community buzz showed an honest empty state, with actual linked listing counts.
- Project widths 320, 390, 768 and 1024 px: no horizontal page overflow. Mobile radius controls also fit 320 and 390 px. Default desktop preview was checked at 1280 px. No browser console errors were recorded for the final build.

## Content limits

No live property feed, auction results or community news were supplied in this task. No transactions or official specifications were invented. Approved update publishing and builder document fields are documented in COMMUNITY-UPDATES.md. Positive update validation is tested using a test-only fixture that is never published. An actual uploaded builder PDF was not available for visual verification; iframe rendering depends on browser support and the external document provider's embedding policy. The reader removes download controls but is not DRM. Authentication and hosted database provisioning were outside this change.
