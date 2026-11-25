# Community updates and project documents

The project page highlights the newest approved community update near the project price and lists up to 12 updates in Community buzz. News is stored with the project in the existing approved catalog, not in a generated news feed.

Add entries to `projects[].profile.communityUpdates` in the approved catalog JSON. Each entry needs:

| Field | Meaning |
| --- | --- |
| `id` | Stable update identifier |
| `category` | `auction`, `sale`, `news`, or `milestone` |
| `title`, `summary` | Accurate account of this specific project/community |
| `publishedAt` | Source publication time as an ISO datetime, including timezone |
| `sourceName`, `sourceUrl` | Publisher name and a direct HTTPS source supporting the claims |
| `verified` | Set to `true` only after your editorial team has checked the source and the project match |
| `amount` | Optional documented rupee amount; do not use an asking price as a registered sale or auction result |
| `configuration`, `areaSqft` | Optional unit details supported by the same source |

Updates without approval, with invalid dates, or dated in the future are withheld. Schema validation rejects unsafe URLs and invalid amounts. The renderer sorts newest first and shows the publication date and source link. No auction records, sale results, comments, activity counts or news articles are fabricated. An empty community shows its actual listed sale/rent counts instead. Supplying the feed and approving updates remain editorial tasks; this change does not crawl or automatically verify news.

Use the existing `catalog:publish` workflow described in [PRODUCTION.md](PRODUCTION.md) after reviewing the catalog. No new database project or credentials are required for this UI change.

## Online brochures and floor plans

Set `profile.brochurePages` to approved page-image URLs for the most consistent inline reading experience, or set the existing `profile.brochureUrl` to an image or embeddable PDF. The UI has no brochure download button. PDF viewer controls are hidden where supported by the browser; web content cannot be made impossible to save or screenshot. External documents must permit embedding. Same-origin PDFs belong under `/brochures/` or `/plans/`; these paths allow same-origin framing only. Ordinary app pages retain `DENY` and CSP `frame-ancestors none`.

Floor plan tabs include all project configurations. Attach actual builder plans through `profile.floorPlans`. A missing configuration displays an explicit unavailable state; it never substitutes an illustrative image for a builder plan. Specifications use the existing `profile.specifications` fields. When the builder has not supplied a brochure, the reader presents a clearly labelled brief based on the project listing.
