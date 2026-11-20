# PropIT production runbook

## Release status

The application now has Supabase email/Google sign-in, per-account saved homes and searches,
durable viewing/listing submissions, and production request protection. Local previews continue
to use labelled generated inventory. A database choice alone does not turn this into real inventory.
Do not publish generated listings, registration numbers, reviews, floor plans or prices as real data.

Customer entry points are `/login` and `/signup`. Email login only accepts existing accounts;
sign-up explicitly permits account creation and records the supplied display name. Both offer Google
and preserve a safe return destination through email confirmation or OAuth. The forms include resend
cooldowns, recoverable expired-link messages and accessible loading states. Account controls remain
disabled until valid public configuration is present. Per the owner's instruction, hosted Supabase
setup is deferred to the owner; this implementation does not provision or change that service.

The production launch requires the actual PropIT Supabase project, server environment values,
approved listing data, real email/Google tests and an enquiry handling owner. The current migration
is additive but must be reviewed against existing tables before it is applied to an existing database.

## Supabase setup

1. Select the existing PropIT project. Inspect its schemas, migrations and security advisors. Back up
   any existing customer data. Do not apply this migration to an unrelated project.
2. Apply `supabase/migrations/202611210001_customer_platform.sql` once. It creates the private
   customer tables, approved catalog snapshots and shared rate-budget functions. Tables with the
   same names must be reconciled first; the migration intentionally fails rather than replacing them.
3. Enable email and Google in Authentication. Keep email confirmation enabled. Configure production
   SMTP with a verified sending domain and delivery monitoring; test spam-folder delivery too.
4. Set the Supabase Site URL to the canonical HTTPS PropIT domain. Add exact redirect URLs for
   `/auth/callback` on that domain and explicitly approved localhost/preview origins. Avoid broad
   wildcard redirect allowances in production.
5. Configure the Google OAuth client with the Supabase provider callback URL shown in its dashboard.
   Keep the Google client secret in Supabase, never in this repository or browser environment.
6. The default email link and browser PKCE flow returns through `/auth/callback`. For email templates
   supporting a new browser/device, use a token-hash link to the canonical site, for example
   `https://YOUR_DOMAIN/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/profile`.
   Test both signup and repeat sign-in with the chosen template. An expired/used link must show recovery.
7. Configure Auth abuse protection (provider rate limits and, if needed, CAPTCHA before opening
   broad registration). The app's request budgets do not replace Supabase Auth endpoint protections.

## Vercel environment

Set these values in Vercel Production before building. Public variables are compiled into the
browser bundle, so rebuild after changing them. Never paste secrets into chat or commit them.

| Variable | Scope and purpose |
| --- | --- |
| `PROPIT_MODE=production` | Explicit production intent; Vercel production also enforces this automatically |
| `NEXT_PUBLIC_SITE_URL` | Canonical HTTPS origin, no path/query/hash |
| `NEXT_PUBLIC_SUPABASE_URL` | PropIT project's HTTPS API origin |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public client key; customer access is constrained by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only; distributed budgets and operator catalog publication |
| `RATE_LIMIT_SECRET` | Server only; cryptographically random, at least 32 characters |
| `ANTHROPIC_API_KEY` | Optional server-only paid conversational assistant |
| `ANTHROPIC_MODEL` | Optional supported model ID available to the account |

The service role must never reach client code. Rotating it requires redeployment. The production
request identity uses Vercel's platform-overwritten IP header; non-Vercel deployments need a trusted
proxy identity strategy before production traffic. A request-budget database failure returns 503.
Paid assistant requests require a verified account and share a global budget. Guests retain grounded
catalog answers. Third-party basemap/routing/geocoding providers still have their own availability,
usage terms and limits; configure an appropriate paid provider for the expected public traffic.

`vercel.json` uses `scripts/vercel-build.mjs`. Production builds run dependency readiness checks
before Next builds; previews remain labelled and noindexed. Existing Vercel project build-command
overrides must not bypass this gate. `/api/health` reports 503 for an unready production deployment
without exposing configuration or customer data. Monitor it externally, plus Vercel runtime errors,
Supabase database/Auth metrics, SMTP delivery, and cost/usage limits.

## Approved property inventory

The initial production architecture serves a validated Hyderabad snapshot from Supabase with a
60-second per-instance refresh. The schema supports at most 20,000 properties and a 20MB payload;
benchmark realistic catalog sizes before increasing those limits or migrating to paginated PostGIS
queries. Every matched property is included in map points; only the visible result cards are paginated.
A failed refresh returns a recoverable error and never substitutes generated inventory.

Prepare JSON matching `src/lib/data/catalog-schema.ts`: `city`, `localities`, `developers`, `projects`,
`properties`, `pois`. Include the real approved image/plan/document URLs, prices, availability and
registration sources. Missing optional documents stay missing; there are no invented replacement plans.
Check that photos/documents are licensed for use and that a property's pin, area units and locality agree.

```bash
npm run catalog:publish -- /private/path/approved-catalog.json 'Your approved source' --approved-real-listings
npm run check:production
```

The publisher validates cross references, uploads a private draft, then publishes it transactionally.
Only one snapshot per city is public. Keep older snapshots for rollback; call `publish_catalog` with
the previously approved snapshot ID through a secure operator context. Customer JWTs cannot publish.

## Customer flows and operations

Saved homes, recent properties, comparison and saved searches sync to `customer_states`. Local browser
namespaces are separate per account; guest data is separate. Optimistic versions rebase concurrent edits.
Unsynced changes remain on the current device and show a retry message. Browsing anchors are transient;
anchors inside an explicitly saved search sync as part of that search.

Viewing enquiries and seller submissions are private to their creator and stored with idempotency
references. They enter **pending** status. The UI does not promise a confirmed appointment, a published
listing, sent email or completed sale. There is no automatic dispatch to builders or broker CRM yet.
Customers have read-only owner access to these tables. Inserts go through the authenticated server
API so public Supabase calls cannot bypass submission validation or request budgets.
Assign an operations owner to review the Supabase queues and contact customers through your approved
workflow. An admin portal, notification dispatch, payments and a real transaction feed are not implemented.

Before public launch, provide real company contact details, privacy/terms documents, consent and retention
requirements, a customer support route, backup policy and a documented restore drill. Do not treat the
existing product About page as a legal privacy policy. Database backups and capacity depend on the
selected Supabase plan; verify the actual plan and quotas rather than assuming enterprise coverage.

## Acceptance and release

```bash
npm ci
npm audit --omit=dev --audit-level=high
npm run lint -- --max-warnings=0
npm run test
npm run check:map
npm run build
npm run typecheck
# In a second terminal: npm run start -- --hostname 127.0.0.1 --port 3004
SMOKE_BASE=http://127.0.0.1:3004 npm run smoke
SMOKE_BASE=http://127.0.0.1:3004 npm run test:http
```

GitHub Actions runs these on pushes and pull requests. The SQL regression uses real PostgreSQL via
PGlite with Supabase-like roles/auth fixtures. It proves migration rules locally; it does not prove
your hosted project's configuration or real provider delivery. The HTTP load test measures 100 local
searches with 10 concurrent clients, not public internet latency or sustained production capacity.

On a protected deployment with real configuration, use two owned test accounts to verify email and
Google sign-in, refresh, expiry/recovery, sign-out, cross-device saved searches, account switching,
simultaneous saves, viewing requests, duplicate retries, seller review queues, offline recovery and
database outage behavior. Confirm account A cannot access account B via direct REST/API calls.
Exercise map locality scope, markers to full details, filters, comparison add/remove, plans/documents,
AI context/source links, touch navigation, keyboard focus and reduced-motion settings on mobile,
tablet and desktop. Check customer data is absent from logs and shared caches.

Promote only after the real-provider and approved-inventory checks pass. Watch the deployment and
error metrics after release. Roll back the Vercel deployment for application failures; preserve the
additive database schema and customer records. Do not drop tables during an application rollback.

## Technical references

- [Supabase server-side clients and session refresh](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Vercel request headers](https://vercel.com/docs/headers/request-headers)

Next.js conventions were checked against the installed `next/dist/docs` for version 16.4.6.
