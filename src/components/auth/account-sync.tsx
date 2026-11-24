"use client";
import { useEffect } from "react";
import { useDiscovery, setDiscoveryOwner } from "@/store/discovery";
import { accountStateSchema, EMPTY_ACCOUNT_STATE, mergeAccountState, type AccountState } from "@/lib/account/schema";

function snapshot(): AccountState { return accountStateSchema.parse(useDiscovery.getState()); }

export function AccountSync({ userId, loading, configured, onError }: { userId: string | null; loading: boolean; configured: boolean; onError: (message: string | null) => void }) {
  useEffect(() => {
    if (loading || !configured) return;
    let stopped = false, initialized = false, running = false;
    let version = 0, base: AccountState = EMPTY_ACCOUNT_STATE;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe: (() => void) | undefined;
    const abort = new AbortController();
    const baseKey = `propit.sync-base.${userId}`;
    const signal = () => AbortSignal.any([abort.signal, AbortSignal.timeout(12_000)]);
    function schedule(delay = 900) {
      if (timer) clearTimeout(timer);
      if (!stopped) timer = setTimeout(() => void flush(), delay);
    }
    function remember() {
      try { localStorage.setItem(baseKey, JSON.stringify(base)); } catch { /* Server state remains authoritative. */ }
    }
    async function load() {
      const response = await fetch("/api/account/state", { cache: "no-store", signal: signal() });
      if (!response.ok) throw new Error("Account sync unavailable.");
      const result = await response.json();
      const remote = accountStateSchema.parse(result.state);
      if (!Number.isSafeInteger(result.version) || result.version < 0) throw new Error("Invalid account version.");
      if (stopped) return;
      let previous = EMPTY_ACCOUNT_STATE;
      try { previous = accountStateSchema.parse(JSON.parse(localStorage.getItem(baseKey) ?? "null")); } catch { /* First visit on this device. */ }
      const merged = mergeAccountState(previous, snapshot(), remote);
      base = remote; version = result.version; initialized = true; remember();
      useDiscovery.setState(merged);
      onError(null);
    }
    async function flush() {
      if (stopped || running || !userId) return;
      running = true;
      try {
        if (!initialized) await load();
        if (stopped) return;
        const outgoing = snapshot();
        if (JSON.stringify(outgoing) === JSON.stringify(base)) { onError(null); return; }
        const response = await fetch("/api/account/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: outgoing, version }), signal: signal() });
        const result = await response.json();
        if (stopped) return;
        if (response.status === 409) {
          const remote = accountStateSchema.parse(result.state);
          if (!Number.isSafeInteger(result.version) || result.version < 0) throw new Error("Invalid account version.");
          const merged = mergeAccountState(base, snapshot(), remote);
          base = remote; version = result.version; remember(); useDiscovery.setState(merged); schedule(); return;
        }
        if (!response.ok || !Number.isSafeInteger(result.version) || result.version <= version) throw new Error("Account sync failed.");
        base = outgoing; version = result.version; remember(); onError(null);
        if (JSON.stringify(snapshot()) !== JSON.stringify(base)) schedule();
      } catch {
        if (!stopped) { onError("Your latest changes haven’t synced yet. Keep this page open and retry."); schedule(30_000); }
      } finally { running = false; }
    }
    const retry = () => { if (!stopped) void flush(); };
    void (async () => {
      await setDiscoveryOwner(userId);
      if (stopped || !userId) { if (!stopped) onError(null); return; }
      unsubscribe = useDiscovery.subscribe((current, previous) => {
        if (current.savedIds !== previous.savedIds || current.savedProjectIds !== previous.savedProjectIds || current.compareIds !== previous.compareIds || current.recentIds !== previous.recentIds || current.savedSearches !== previous.savedSearches) schedule();
      });
      window.addEventListener("online", retry); window.addEventListener("propit:retry-sync", retry);
      await flush();
    })().catch(() => { if (!stopped) onError("We couldn’t load your account. Refresh to try again."); });
    return () => { stopped = true; abort.abort(); if (timer) clearTimeout(timer); unsubscribe?.(); window.removeEventListener("online", retry); window.removeEventListener("propit:retry-sync", retry); };
  }, [userId, loading, configured, onError]);
  return null;
}
