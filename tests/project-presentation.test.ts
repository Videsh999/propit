import test from "node:test";
import assert from "node:assert/strict";
import { configurationLabel, filterProjectListings, median, projectPricePoints, uniqueProjectPhotos, type ProjectListing } from "../src/lib/data/project-presentation";

const home: ProjectListing = { id: "sale-small", slug: "sale-small", title: "Test home", listingType: "buy", propertyType: "apartment", price: 10_000_000, rentMonthly: null, bedrooms: 2, builtupAreaSqft: 1000 };
const listings: ProjectListing[] = [home, { ...home, id: "sale-large", price: 18_000_000, builtupAreaSqft: 1500 }, { ...home, id: "sale-three", bedrooms: 3, price: 24_000_000, builtupAreaSqft: 2000 }, { ...home, id: "rent-low", listingType: "rent", price: 99_000_000, rentMonthly: 40_000 }, { ...home, id: "rent-high", listingType: "rent", price: 1_000_000, rentMonthly: 60_000 }];

test("the project gallery removes duplicate CDN sizes without merging distinct signed assets", () => {
  assert.deepEqual(uniqueProjectPhotos(["", "https://images.unsplash.com/photo-one?w=800", "https://images.unsplash.com/photo-one?w=1200&q=80", "/photo-two.webp", "/photo-two.webp", "https://example.com/image?id=1", "https://example.com/image?id=2"]), ["https://images.unsplash.com/photo-one?w=800", "/photo-two.webp", "https://example.com/image?id=1", "https://example.com/image?id=2"]);
});

test("project inventory combines intent, type and configuration without mixing rental and sale prices", () => {
  assert.deepEqual(filterProjectListings(listings, { mode: "rent", sort: "price_asc" }).map(item => item.id), ["rent-low", "rent-high"]);
  assert.deepEqual(filterProjectListings(listings, { mode: "rent", sort: "price_desc" }).map(item => item.id), ["rent-high", "rent-low"]);
  assert.deepEqual(filterProjectListings(listings, { mode: "buy", configuration: "3 BHK", type: "apartment", sort: "area_desc" }).map(item => item.id), ["sale-three"]);
  assert.deepEqual(filterProjectListings(listings, { mode: "buy", type: "villa", sort: "price_asc" }), []);
  assert.equal(listings[0].id, "sale-small", "Sorting does not mutate the source inventory");
});

test("asking-price charts use valid samples and report configuration medians, not sale counts", () => {
  const invalid: ProjectListing[] = [{ ...home, id: "no-area", builtupAreaSqft: 0 }, { ...home, id: "no-price", price: 0 }, { ...home, id: "no-rent", listingType: "rent", rentMonthly: null }];
  const sale = projectPricePoints([...listings, ...invalid], "buy");
  assert.deepEqual(sale[0], { label: "2 BHK", value: 11_000, count: 2, min: 10_000, max: 12_000 });
  assert.deepEqual(projectPricePoints([...listings, ...invalid], "rent")[0], { label: "2 BHK", value: 50_000, count: 2, min: 40_000, max: 60_000 });
  assert.deepEqual(projectPricePoints([], "buy"), []);
  assert.equal(median([0, NaN, Infinity]), null);
});

test("plots and commercial space are not presented as studio homes, and on-request prices sort last", () => {
  assert.equal(configurationLabel({ ...home, propertyType: "plot", bedrooms: 0 }), "Plot");
  assert.equal(configurationLabel({ ...home, propertyType: "commercial", bedrooms: 0 }), "Commercial");
  assert.equal(configurationLabel({ ...home, bedrooms: 0 }), "Studio");
  const unknown = { ...home, id: "on-request", listingType: "rent" as const, rentMonthly: null };
  for (const sort of ["price_asc", "price_desc"] as const) assert.equal(filterProjectListings([...listings, unknown], { mode: "rent", sort }).at(-1)?.id, "on-request");
});
