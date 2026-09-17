"use client";

import { useSyncExternalStore } from "react";
import { useDiscovery } from "@/store/discovery";

/**
 * True once the persisted store has been rehydrated from localStorage.
 *
 * Rendering saved items before rehydration would flash an empty state, and
 * setting a flag from an effect causes a cascading render — so we subscribe to
 * zustand's own hydration signal instead.
 */
export function useStoreHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useDiscovery.persist.onFinishHydration(cb),
    () => useDiscovery.persist.hasHydrated(),
    () => false,
  );
}
