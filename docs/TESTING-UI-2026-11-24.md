# PropIT visual and detail-page verification — 24 November 2026

The warm ivory and bronze theme now covers the atlas, markers, logo, surfaces, forms and chatbot.
Project and property pages expose enquiry, save and sharing controls above the gallery. Project
favourites use the existing account-state JSON schema with a backwards-compatible empty default.
No hosted schema changes were made.

Amenities use category cards and numbered lists. Nearby destinations show one category at a time,
with at most three places. The travel diagram is interactive on desktop and collapsed by default on
phones. Its travel times are estimates from straight-line distances, not live routing results.

## Automated verification

- Production build, TypeScript and zero-warning ESLint passed.
- All 18 test groups passed, including saved-project limits, compatibility, concurrent edits and
  account isolation. Existing auth SDK and Postgres RLS tests also passed.
- Full HTTP smoke checks passed: search, map markers, radius/drawing, livable zones, comparison,
  chatbot streams, pages, validation and the new saved-project summaries endpoint.
- HTTP security checks passed: CSP nonces, cross-site mutation rejection, auth redirects, payload
  limits, rate limits and no-store private responses.
- 100 local search requests at concurrency 10: zero errors; p50 14 ms, p95 17 ms, maximum 28 ms.
  This is local server processing and does not measure public network or third-party tile latency.
- Light/dark basemap contrast and locally served font stacks passed. Label contrast: 5.00:1 light,
  9.13:1 dark.
- Secondary and small text meet 4.5:1 on all three light surfaces: 5.30:1 on paper,
  4.94:1 on inset panels and 4.66:1 on the accent wash.

## Browser verification

Checked the home map, project amenities and location, property details, project shortlist and login
return path. Saved a project, reloaded it, found it under Saved projects and removed the test save.
Enquiry opened in a modal; Escape closed it, restored focus and unlocked body scrolling. Project
category tabs and destination highlights updated their content. The mobile diagram expanded and
selected a destination correctly. No browser console errors were observed in these flows.

Property layouts fit at 320, 390, 768, 1024 and 1440 px without document overflow. The enquiry modal
fit a 320 px phone. Mobile location lists remain short and keep the diagram behind a disclosure.

## External dependencies still pending

The Supabase connector lists only “review orm” and “ReviewAi”, both inactive, and does not expose
PropIT. Live email/Google sign-in, customer data persistence and enquiry delivery cannot be claimed
as verified until the correct project is accessible and configured. Attempting sign-in without
configuration shows a recoverable service-unavailable message. No unrelated project was modified.
Local preview inventory and photographs remain illustrative, not approved public listings.
