# Project page redesign — 24 November 2026

The project page uses a split gallery and summary, compact icon facts, top enquiry/save/share
controls, paired About/Amenities panels, price insights, and filterable listing cards. Long project
and construction details remain available in disclosures. Related projects use compact links.
The existing warm ivory and bronze palette is preserved.

## Data and behaviour

The gallery removes duplicate Unsplash photo sizes while retaining distinct assets and signed
URLs. Photos support previous/next, thumbnails and arrow keys. A supplied video can be selected
from the gallery. Map navigation opens a project-scoped map, loaded when it approaches the view.

Price insights distinguish annual locality averages from current listing asking prices. Estimated
locality data is labelled as modelled. Sale charts use median asking price per square foot; rental
charts use monthly asking rents. Invalid/zero samples are excluded. Configuration charts report
listing sample counts, not registered sales. Chart points support keyboard selection and an
accessible data table. No registered-transaction history was invented for this design.

Inventory filters combine Buy/Rent, property type, configuration and sorting. Counts reflect the
active selection, rental sorting uses monthly rent, and unknown prices sort last. Only six cards
are initially rendered; additional cards can be expanded. Comparison buttons and property links
remain separate controls. Component keys reset filters, chart selection and map state when the
visitor switches projects. The specification section retains its previous fragment ID.

## Verification

- All 22 test groups passed, including four project-presentation groups covering image identity,
  combined filters, monthly-rent sorting, asking-price medians, invalid samples, plot/commercial
  labelling and unknown prices. Existing auth, account isolation and database tests also passed.
- Production compilation, TypeScript and zero-warning ESLint passed.
- The full HTTP smoke suite passed: search, maps, radius/drawing, locality intelligence, comparison,
  saved projects, assistant streams, page rendering, invalid input and unknown-route responses.
- Browser checks covered gallery buttons and arrow keys, chart modes and arrow-key selection,
  the chart data table, rental/configuration filtering, comparison add/remove and full property
  navigation. The temporary comparison selection was removed after testing.
- Switching to another project reset Buy/Rent and configuration selections. Its map/location
  section showed the new locality. Nearby category lists remained limited to three destinations.
- Layouts at 320, 390, 768, 1024 and 1440 px had no document overflow; top actions fit each width.
  Chart axis labels use HTML text so they stay readable when the graph scales on phones.
- No console errors or warnings were observed in the exercised browser flows.

## Regression found and fixed

Native fragment links could leave property content visible after Back changed the URL to the
project or home page. Section links now use Next Link, preserving router history. Both flows were
retested: project section → property → Back restored the project; home Browse homes → property →
Back restored the home listing section. Sticky-section offsets account for the main navigation.

This verifies the local preview and its implemented interactions. Preview listings and images
remain illustrative. Existing production data and authentication prerequisites are unchanged.
