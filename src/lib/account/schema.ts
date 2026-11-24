import { z } from "zod";
import { anchorSchema, filtersSchema, latLngSchema } from "@/lib/api/schema";
const ids = (max: number) => z.array(z.string().min(1).max(120)).max(max).transform(values => [...new Set(values)]);
export const accountStateSchema = z.object({
  savedIds: ids(200).default([]), savedProjectIds: ids(100).default([]), compareIds: ids(4).default([]), recentIds: ids(60).default([]),
  savedSearches: z.array(z.object({
    id: z.string().min(1).max(120), name: z.string().trim().min(1).max(160), createdAt: z.string().datetime(),
    filters: filtersSchema, anchors: z.array(anchorSchema).max(6),
    radius: z.object({ center: latLngSchema, km: z.number().positive().max(60), label: z.string().max(200), anchorId: z.string().max(120).optional() }).nullable(),
  })).max(30).default([]),
});
export type AccountState = z.infer<typeof accountStateSchema>;
export const EMPTY_ACCOUNT_STATE: AccountState = { savedIds: [], savedProjectIds: [], compareIds: [], recentIds: [], savedSearches: [] };

/** Apply local additions/removals to the latest server version on a conflict. */
export function mergeAccountState(base: AccountState, local: AccountState, remote: AccountState): AccountState {
  function mergeIds(key: "savedIds" | "savedProjectIds" | "compareIds" | "recentIds", limit: number) {
    const removed = new Set(base[key].filter(id => !local[key].includes(id)));
    const added = local[key].filter(id => !base[key].includes(id));
    return [...new Set([...added, ...remote[key].filter(id => !removed.has(id))])].slice(0, limit);
  }
  const searches = new Map(remote.savedSearches.map(search => [search.id, search]));
  for (const old of base.savedSearches) if (!local.savedSearches.some(search => search.id === old.id)) searches.delete(old.id);
  for (const search of local.savedSearches) if (JSON.stringify(search) !== JSON.stringify(base.savedSearches.find(old => old.id === search.id))) searches.set(search.id, search);
  return { savedIds: mergeIds("savedIds", 200), savedProjectIds: mergeIds("savedProjectIds", 100), compareIds: mergeIds("compareIds", 4), recentIds: mergeIds("recentIds", 60), savedSearches: [...searches.values()].slice(0, 30) };
}
