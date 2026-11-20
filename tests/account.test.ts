import test from "node:test";
import assert from "node:assert/strict";
import { accountStateSchema, EMPTY_ACCOUNT_STATE as empty, mergeAccountState } from "../src/lib/account/schema";
import { setDiscoveryOwner, useDiscovery } from "../src/store/discovery";

test("concurrent saved-home edits retain the other device's additions and local removals", () => {
  const base = { ...empty, savedIds: ["a", "b"] };
  const local = { ...empty, savedIds: ["b", "c"] };
  const remote = { ...empty, savedIds: ["a", "b", "d"] };
  assert.deepEqual(mergeAccountState(base, local, remote).savedIds, ["c", "b", "d"]);
  assert.equal(mergeAccountState(empty, { ...empty, compareIds: ["a", "b", "c", "d"] }, { ...empty, compareIds: ["e"] }).compareIds.length, 4);
  assert.equal(accountStateSchema.safeParse({ savedIds: Array(201).fill("a") }).success, false);
});

test("switching accounts and signing out clears the previous customer's private state", async () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } });
  await setDiscoveryOwner("buyer-a");
  useDiscovery.setState({ savedIds: ["private-home"], compareIds: ["private-compare"], recentIds: ["private-history"], anchors: [{ id: "office", label: "Private office", address: "Private address", kind: "office", location: { lat: 17.4, lng: 78.4 }, maxKm: 5, weight: 1 }] });
  await setDiscoveryOwner("buyer-b");
  assert.deepEqual(useDiscovery.getState().savedIds, []);
  assert.deepEqual(useDiscovery.getState().compareIds, []);
  assert.deepEqual(useDiscovery.getState().recentIds, []);
  assert.deepEqual(useDiscovery.getState().anchors, []);
  useDiscovery.setState({ savedIds: ["b-home"] });
  await setDiscoveryOwner("buyer-a");
  assert.deepEqual(useDiscovery.getState().savedIds, ["private-home"]);
  await setDiscoveryOwner("buyer-b");
  assert.deepEqual(useDiscovery.getState().savedIds, ["b-home"]);
  await setDiscoveryOwner(null);
  assert.deepEqual(useDiscovery.getState().savedIds, []);
  values.set("propit.account.corrupt", "invalid-json");
  await setDiscoveryOwner("corrupt");
  assert.deepEqual(useDiscovery.getState().savedIds, []);
  await setDiscoveryOwner(null);
  Reflect.deleteProperty(globalThis, "localStorage");
});
