import test from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "../src/lib/auth/redirect";
import { calendarDate, indiaToday } from "../src/lib/date";
import { parsePropertyQuery } from "../src/lib/api/schema";
import { meetingSchema, listingSubmissionSchema } from "../src/lib/submissions/schema";
import { catalogSchema } from "../src/lib/data/catalog-schema";
import { getStore } from "../src/lib/data/store";
import { queryProperties } from "../src/lib/data/repository";

test("authentication redirects stay on this site, including encoded bypasses", () => {
  for (const value of ["https://evil.test", "//evil.test", "/\\evil.test", "%2f%2fevil.test", "/%5cevil.test", "/%252f%252fevil.test", " /profile", "/\n/evil.test"]) {
    assert.equal(safeNextPath(value), "/profile", value);
  }
  assert.equal(safeNextPath("/property/a?ref=map#plans"), "/property/a?ref=map#plans");
});

test("viewing dates use India midnight and reject impossible dates", () => {
  assert.equal(indiaToday(new Date("2026-11-20T20:00:00Z")), "2026-11-21");
  assert.equal(calendarDate("2026-02-30"), false);
  assert.equal(calendarDate("2028-02-29"), true);
  assert.equal(calendarDate("2026-02-29"), false);
  assert.equal(meetingSchema.safeParse({ name: "Test buyer", phone: "9876543210", mode: "site", date: "2026-02-30", slot: "morning" }).success, false);
});

test("property filters reject invalid ranges, coordinates, enum values and unbounded work", () => {
  for (const query of ["minPrice=NaN", "maxPrice=Infinity", "minArea=2000&maxArea=1000", "minPrice=20&maxPrice=10", "lat=200&lng=78", "radiusKm=3", "west=80&east=78&south=17&north=18", "west=78", "offset=-1", "limit=99999", "sort=sql", "bhk=3,no"]) {
    assert.throws(() => parsePropertyQuery(new URLSearchParams(query)), query);
  }
  const valid = parsePropertyQuery(new URLSearchParams("type=rent&bhk=3&maxPrice=70000&lat=17.44&lng=78.35&radiusKm=5"));
  assert.equal(valid.filters.listingType, "rent");
  assert.equal(valid.radiusKm, 5);
  assert.equal(listingSubmissionSchema.safeParse({}).success, false);
});

test("rental sorting uses monthly rent, and every match reaches the map", () => {
  const low = queryProperties({ filters: { listingType: "rent" }, sort: "price_asc", limit: 100 });
  const high = queryProperties({ filters: { listingType: "rent" }, sort: "price_desc", limit: 100 });
  assert.ok(low.items.length > 5);
  for (let i = 1; i < low.items.length; i++) assert.ok(low.items[i - 1].rentMonthly! <= low.items[i].rentMonthly!);
  for (let i = 1; i < high.items.length; i++) assert.ok(high.items[i - 1].rentMonthly! >= high.items[i].rentMonthly!);
  assert.equal(low.points.length, low.total);
});

test("catalog publishing validates references and fails on duplicate or orphan listings", () => {
  const store = getStore();
  const input = { city: store.city, localities: store.localities, developers: store.developers, projects: store.projects, properties: store.properties, pois: store.pois };
  assert.equal(catalogSchema.safeParse(input).success, true);
  assert.equal(catalogSchema.safeParse({ ...input, properties: [...input.properties, input.properties[0]] }).success, false);
  assert.equal(catalogSchema.safeParse({ ...input, properties: [{ ...input.properties[0], localityId: "missing" }] }).success, false);
});
