"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/components/auth/auth-provider";

export function Providers({ children, authConfigured, production }: { children: React.ReactNode; authConfigured: boolean; production: boolean }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}><AuthProvider configured={authConfigured} production={production}>{children}</AuthProvider></QueryClientProvider>;
}
