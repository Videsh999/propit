"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useDiscovery } from "@/store/discovery";
import { formatPrice, formatRent } from "@/lib/format";
import { RangeFilter } from "./range-filter";

export function BudgetMeter() {
  const filters = useDiscovery(state => state.filters), setFilters = useDiscovery(state => state.setFilters);
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const rent = filters.listingType === "rent";
  useEffect(() => {
    if (!position) return;
    const close = (event: MouseEvent) => { if (!wrap.current?.contains(event.target as Node)) setPosition(null); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setPosition(null); };
    const resize = () => setPosition(null);
    document.addEventListener("mousedown", close); document.addEventListener("keydown", key); window.addEventListener("resize", resize);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); window.removeEventListener("resize", resize); };
  }, [position]);
  const format = (value: number) => rent ? formatRent(value) : formatPrice(value);
  return <div ref={wrap} className="relative min-w-0"><button type="button" aria-label="Budget" aria-expanded={!!position} onClick={event => { if (position) { setPosition(null); return; } const rect = event.currentTarget.getBoundingClientRect(); const width = Math.min(340, innerWidth - 24); setPosition({ left: Math.max(12, Math.min(rect.left, innerWidth - width - 12)), top: Math.min(rect.bottom + 8, Math.max(80, innerHeight - 425)), width }); }} className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-line bg-sunk px-3 text-[14px] text-ink"><span className="truncate">{filters.priceMax == null && filters.priceMin == null ? "Budget" : filters.priceMax != null ? `Up to ${format(filters.priceMax)}` : `From ${format(filters.priceMin!)}`}</span><ChevronDown size={14} className="shrink-0" /></button>
    {position && <div role="dialog" aria-label="Budget range" className="fixed z-[70] max-h-[80dvh] overflow-y-auto rounded-2xl border border-line bg-raised p-5 shadow-e3" style={position}><RangeFilter label={rent ? "Monthly rent" : "Budget"} value={[filters.priceMin, filters.priceMax]} max={rent ? 500000 : 100000000} step={rent ? 1000 : 100000} format={format} onChange={([priceMin, priceMax]) => setFilters({ priceMin, priceMax })} /><button type="button" onClick={() => setPosition(null)} className="mt-4 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-ink">Done</button></div>}
  </div>;
}
