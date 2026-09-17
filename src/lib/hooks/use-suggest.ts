"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export interface Suggestion {
  id: string;
  group: "Localities" | "Projects" | "Developers" | "Nearby" | "Properties";
  label: string;
  sublabel: string;
  href: string | null;
  location: { lat: number; lng: number } | null;
  slug: string | null;
  count?: number;
}

export interface ParsedHint {
  filters: Record<string, unknown>;
  nearPlace: string | null;
  radiusKm: number | null;
  maxMinutes: number | null;
  localityMentions: string[];
  confidence: number;
  isQuestion: boolean;
}

export function useDebounced<T>(value: T, ms = 180): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function useSuggest(query: string) {
  const q = useDebounced(query.trim(), 180);
  return useQuery<{ suggestions: Suggestion[]; parsed: ParsedHint | null }>({
    queryKey: ["suggest", q],
    enabled: q.length > 0,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, { signal });
      if (!res.ok) return { suggestions: [], parsed: null };
      return res.json();
    },
  });
}
