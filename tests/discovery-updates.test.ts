import test from "node:test";
import assert from "node:assert/strict";
import { parsePropertyQuery } from "../src/lib/api/schema";
import { queryProperties } from "../src/lib/data/repository";
import { DEFAULT_FILTERS } from "../src/lib/data/filters";
import { filtersToParams, useDiscovery } from "../src/store/discovery";
import { haversineKm } from "../src/lib/geo/distance";
import { communityUpdateSchema, publishedCommunityUpdates } from "../src/lib/data/community";

// This is a schema fixture, never a published event or production seed.
const update = { id: "fixture", category: "sale" as const, title: "Test sale record", summary: "A test record used only for validation.", publishedAt: "2026-11-20T10:00:00Z", sourceName: "Test source", sourceUrl: "https://example.com/record", verified: true, amount: 60_000_000 };

test("floor bounds survive URL sharing, including ground floor, and reject invalid limits", () => {
  const params = filtersToParams({ ...DEFAULT_FILTERS, floorMin: 0, floorMax: 10, localitySlugs: ["kokapet", "gachibowli"] }, [], null);
  const parsed = parsePropertyQuery(params);
  assert.equal(parsed.filters.floorMin, 0);
  assert.equal(parsed.filters.floorMax, 10);
  assert.deepEqual(parsed.filters.localitySlugs, ["kokapet", "gachibowli"]);
  for (const query of ["minFloor=20&maxFloor=2", "maxFloor=201", "minFloor=-11", "minFloor=1.5", "maxFloor=Infinity"]) assert.throws(() => parsePropertyQuery(new URLSearchParams(query)), query);
  const result = queryProperties({ filters: { floorMin: 4, floorMax: 10 }, limit: 100 });
  assert.ok(result.total > 0);
  assert.ok(result.items.every(home => home.floor >= 4 && home.floor <= 10));
});

test("multiple localities form a union while budget and floor filters intersect that union", () => {
  const filters = { priceMax: 30_000_000, floorMin: 1, floorMax: 12 };
  const a = queryProperties({ filters: { ...filters, localitySlugs: ["kokapet"] } });
  const b = queryProperties({ filters: { ...filters, localitySlugs: ["gachibowli"] } });
  const union = queryProperties({ filters: { ...filters, localitySlugs: ["kokapet", "gachibowli"] } });
  assert.ok(a.total > 0 && b.total > 0);
  assert.equal(union.total, a.total + b.total);
  assert.equal(union.points.length, union.total);
});

test("a pin radius matches exact distances and grows from 500 metres through 2 and 3 kilometres", () => {
  const center = { lat: 17.4293, lng: 78.3486 }; // Wipro Circle
  let previous = 0;
  for (const radiusKm of [0.5, 2, 3]) {
    const result = queryProperties({ center, radiusKm, limit: 100 });
    assert.ok(result.total >= previous);
    assert.ok(result.points.every(point => haversineKm(center, point) <= radiusKm + 1e-9));
    assert.equal(result.total, result.points.length);
    previous = result.total;
  }
  assert.ok(previous > 0);
  const moved = queryProperties({ center: { lat: 17.4933, lng: 78.399 }, radiusKm: 2 });
  const original = queryProperties({ center, radiusKm: 2 });
  assert.notDeepEqual(moved.points.map(point => point.id), original.points.map(point => point.id));
  useDiscovery.getState().setRadiusPinning(true);
  useDiscovery.getState().setDrawMode("polygon");
  assert.equal(useDiscovery.getState().radiusPinning, false);
  useDiscovery.getState().resetFilters();
});

test("community updates need a source, valid facts and explicit approval before publication", () => {
  assert.equal(communityUpdateSchema.safeParse(update).success, true);
  for (const patch of [{ sourceUrl: "javascript:alert(1)" }, { sourceUrl: "http://example.com" }, { sourceName: "" }, { publishedAt: "yesterday" }, { amount: -1 }, { amount: Infinity }]) assert.equal(communityUpdateSchema.safeParse({ ...update, ...patch }).success, false);
  assert.equal(communityUpdateSchema.parse({ ...update, verified: undefined }).verified, false);
  const older = { ...update, id: "older", publishedAt: "2026-11-19T10:00:00Z" };
  const pending = { ...update, id: "pending", verified: false };
  const future = { ...update, id: "future", publishedAt: "2027-01-01T10:00:00Z" };
  const source = [older, future, pending, update];
  assert.deepEqual(publishedCommunityUpdates(source, Date.parse("2026-11-25T00:00:00Z")).map(item => item.id), ["fixture", "older"]);
  assert.equal(source[0].id, "older");
  assert.deepEqual(publishedCommunityUpdates(), []);
});
