"use client";
import { createContext, Fragment, useContext, useEffect, useRef, useState } from "react";
import { browserDatabase } from "@/lib/supabase/browser";
import { AccountSync } from "./account-sync";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import { setDiscoveryOwner } from "@/store/discovery";

type Customer = { id: string; email: string | null };
interface AuthState { user: Customer | null; loading: boolean; configured: boolean; production: boolean; syncError: string | null }
const AuthContext = createContext<AuthState>({ user: null, loading: false, configured: false, production: false, syncError: null });
export const useCustomer = () => useContext(AuthContext);

export function AuthProvider({ children, configured, production }: { children: React.ReactNode; configured: boolean; production: boolean }) {
  const [user, setUser] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(configured);
  const [syncError, setSyncError] = useState<string | null>(null);
  const verifiedId = useRef<string | null>(null);
  useEffect(() => {
    if (!configured) return;
    const database = browserDatabase();
    if (!database) { queueMicrotask(() => setLoading(false)); return; }
    let cancelled = false;
    let generation = 0;
    async function refresh() {
      const current = ++generation;
      try {
        const { data, error } = await database!.auth.getUser();
        const next = error || !data.user ? null : { id: data.user.id, email: data.user.email ?? null };
        if (!cancelled && current === generation) {
          await setDiscoveryOwner(next?.id ?? null);
          if (!cancelled && current === generation) { verifiedId.current = next?.id ?? null; setUser(next); }
        }
      } catch { if (!cancelled && current === generation) { await setDiscoveryOwner(null); if (!cancelled && current === generation) { verifiedId.current = null; setUser(null); } } }
      finally { if (!cancelled && current === generation) setLoading(false); }
    }
    void refresh();
    const { data } = database.auth.onAuthStateChange((event: AuthChangeEvent, session: { user: { id: string } } | null) => {
      if (event === "SIGNED_OUT") { const current = ++generation; setLoading(true); void setDiscoveryOwner(null).then(() => { if (!cancelled && current === generation) { verifiedId.current = null; setUser(null); setLoading(false); } }); }
      else if (event !== "INITIAL_SESSION") { if (session?.user.id !== verifiedId.current) setLoading(true); queueMicrotask(() => { if (!cancelled) void refresh(); }); }
    });
    return () => { cancelled = true; data.subscription.unsubscribe(); };
  }, [configured]);
  return <AuthContext.Provider value={{ user, loading, configured, production, syncError }}>
    <AccountSync userId={user?.id ?? null} loading={loading} configured={configured} onError={setSyncError} />
    <Fragment key={user?.id ?? "guest"}>{children}</Fragment>
  </AuthContext.Provider>;
}
