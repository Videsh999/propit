# Login, sign-up and regression verification — 21 November 2026

## Scope

Implemented separate `/login` and `/signup` screens with email magic links and Google OAuth using
the existing Supabase client/session integration. Added desktop and mobile account entry points.
Email login does not create users; sign-up explicitly permits account creation. The selected property
is retained through switching screens and the authentication callback. Added resend cooldowns,
duplicate-submit guards, field validation, recoverable errors and expired-link guidance.

The owner's instruction is to configure Supabase themselves. No hosted database, Auth configuration,
API keys or environment settings were provisioned or changed during this work. Forms are visible for
review and submission controls remain disabled while the account service is unconfigured.

## Automated results

| Check | Result |
| --- | --- |
| Unit, SDK contract and local database-policy tests | 17 passed, zero failures |
| ESLint | Passed with zero warnings |
| Optimized Next.js build | Passed, including the new signup route |
| TypeScript | Passed |
| Map contrast and glyph checks | Passed |
| Production dependency audit | Zero vulnerabilities |
| Full API and page regression suite | Passed |
| HTTP security and auth-route checks | Passed |
| Concurrent local search | 100 requests, 10 concurrent clients, zero failures |
| Local search timing | p50 15 ms, p95 25 ms, maximum 34 ms |

The SDK contract test uses the actual Supabase JavaScript library with an in-memory HTTP fixture.
It verifies `create_user=false` for login, `create_user=true` for signup, trimmed input, display-name
metadata, PKCE challenges and the callback destination. It sends no email and contacts no hosted
Supabase project. The database-policy tests execute in ephemeral local PostgreSQL through PGlite.

HTTP checks verify nonce CSP, private cache headers, cross-site request rejection, body limits,
protected account responses, safe redirects, AI burst limits and both auth pages' rendered fields.
Performance measurements use the local preview catalog and do not establish public-network latency.

## Browser results

| Customer flow | Evidence |
| --- | --- |
| Empty search recovery | Gachibowli + 3 BHK + under ₹1 Cr showed zero results; Clear filters restored 886 sale results |
| Map locality selection | Gachibowli showed its 19 matching sale listings |
| Map selection to property | Preview's View full property opened the selected Emerald Grove listing |
| Property to login/signup | The same property path remained in `next` through both screens and mobile menu navigation |
| Form validation | Invalid email reported native type mismatch; signup required a full name and email |
| Unconfigured state | Google and email submit controls were disabled with an explanatory status |
| Expired/missing callback | Returned to login with recoverable expired-link guidance |
| Responsive layout | No document overflow at tested widths of 320, 390, 768, 1024, 1280 and 1440 pixels; no clipped header controls in the checked phone, tablet and laptop layouts |
| Scrolling | Home listings, prime localities, project cards and footer remained rendered during scrolling |
| Comparison | Adding a property changed selection from 2 to 3; removing it restored the original 2 |

No browser console errors were observed during these exercised flows. The existing saved comparison
was restored after testing. The local preview remains available at `http://127.0.0.1:3004`.

## Deliberately not verified

Actual email delivery, Google account consent, real user creation, hosted session refresh and cloud
account persistence require the owner's Supabase configuration and owned test accounts. These are
not claimed as passing. The existing production launch safeguard remains in place.
