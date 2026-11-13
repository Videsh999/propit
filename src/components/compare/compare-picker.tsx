"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Check, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Img } from "@/components/ui/img";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounced } from "@/lib/hooks/use-suggest";
import { formatArea, formatPrice, formatRent } from "@/lib/format";
import type { CompareCandidate } from "@/lib/compare/types";
import { MAX_COMPARE_PROPERTIES, useDiscovery } from "@/store/discovery";

type ResultPage = { items: CompareCandidate[]; hasMore: boolean };
const MODES = [
  { id: "all", label: "All listings" },
  { id: "buy", label: "For sale" },
  { id: "rent", label: "For rent" },
] as const;

export function ComparePicker({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<(typeof MODES)[number]["id"]>("all");
  const [announcement, setAnnouncement] = useState("");
  const compareIds = useDiscovery((s) => s.compareIds);
  const addToCompare = useDiscovery((s) => s.addToCompare);
  const full = compareIds.length >= MAX_COMPARE_PROPERTIES;
  const term = useDebounced(query.trim(), 90);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    inputRef.current?.focus();
    return () => dialog?.close();
  }, []);

  const { data, isPending, isError, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, refetch } = useInfiniteQuery({
    queryKey: ["compare-picker", term, mode],
    initialPageParam: 0,
    staleTime: 60_000,
    queryFn: async ({ signal, pageParam }): Promise<ResultPage> => {
      const params = new URLSearchParams({ q: term, type: mode, page: String(pageParam) });
      const response = await fetch(`/api/properties/compare-search?${params}`, { signal });
      if (!response.ok) throw new Error("Couldn’t find properties right now.");
      return response.json();
    },
    getNextPageParam: (lastPage, pages) => lastPage.hasMore ? pages.length : undefined,
  });
  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const searching = isPending || term !== query.trim();

  return (
    <dialog ref={dialogRef} aria-labelledby="compare-picker-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className="fixed inset-0 m-auto w-[calc(100%-24px)] max-w-[560px] overflow-hidden rounded-3xl border border-line bg-raised p-0 text-ink shadow-e3 backdrop:bg-black/45">
      <div className="flex max-h-[min(700px,calc(100dvh-24px))] flex-col">
        <header className="shrink-0 border-b border-line px-4 pb-3 pt-4 sm:px-6">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id="compare-picker-title" className="font-[family-name:var(--font-editorial)] text-[30px] leading-none tracking-tight sm:text-[36px]">Add a property</h2>
              <p className="mt-1.5 text-sm text-muted">{compareIds.length} of {MAX_COMPARE_PROPERTIES} selected</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close property picker"
              className="grid size-10 shrink-0 place-items-center rounded-full border border-line hover:bg-sunk">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <label className="flex h-11 items-center gap-2 rounded-xl border border-line bg-paper px-3 focus-within:border-accent">
            <Search size={16} className="shrink-0 text-muted" aria-hidden="true" />
            <input ref={inputRef} type="search" value={query} maxLength={160}
              aria-label="Search properties to compare" placeholder="Search by name, project or locality"
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint" />
          </label>
          <div role="group" aria-label="Filter by listing type" className="mt-2 flex flex-wrap gap-1.5">
            {MODES.map(({ id, label }) => (
              <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)}
                className="min-h-9 rounded-full border border-line px-3 text-xs font-semibold text-muted hover:bg-sunk aria-pressed:border-accent aria-pressed:bg-accent-wash aria-pressed:text-accent">
                {label}
              </button>
            ))}
          </div>
        </header>
        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2 sm:px-6" aria-busy={searching}>
          {searching ? (
            <div role="status" aria-label="Searching properties" className="grid gap-2 py-2">
              {[0, 1, 2].map((row) => <Skeleton key={row} className="h-16 w-full" />)}
            </div>
          ) : isError && !data ? (
            <div className="py-6 text-sm">Couldn’t load properties.{" "}
              <button type="button" className="font-semibold text-accent underline" onClick={() => void refetch()}>Try again</button>
            </div>
          ) : !items.length ? (
            <p role="status" className="py-6 text-sm text-muted">No properties match this search. Try another name or locality.</p>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {items.map((candidate) => {
                  const selected = compareIds.includes(candidate.id);
                  const price = candidate.listingType === "buy" ? formatPrice(candidate.price)
                    : candidate.rentMonthly == null ? "Rent on request" : formatRent(candidate.rentMonthly);
                  return (
                    <li key={candidate.id} className="flex items-center gap-2.5 py-2.5 sm:gap-3">
                      <Img src={candidate.image ?? ""} alt="" seed={candidate.id} className="size-12 shrink-0 rounded-lg sm:size-14" sizes="56px" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug">{candidate.title}</p>
                        <p className="mt-0.5 text-xs text-muted">{candidate.locality} · {formatArea(candidate.builtupAreaSqft)}</p>
                        <p className="tnum text-xs font-semibold text-accent">{price}</p>
                      </div>
                      <Button type="button" size="sm" variant={selected ? "quiet" : "secondary"}
                        disabled={selected || full} aria-label={selected ? `${candidate.title} already added` : `Add ${candidate.title} to comparison`}
                        onClick={() => {
                          addToCompare(candidate.id);
                          setAnnouncement(`${candidate.title} added to comparison`);
                        }} className="h-10 shrink-0 px-2.5 sm:px-3">
                        {selected ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                        {selected ? "Added" : "Add"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
              {hasNextPage && <Button type="button" size="sm" className="my-3" disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}>
                {isFetchingNextPage ? "Loading…" : isFetchNextPageError ? "Retry loading more" : "Show more properties"}
              </Button>}
            </>
          )}
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 sm:px-6">
          {full ? <p className="text-xs text-muted">Comparison full. Remove a property to add another.</p>
            : <Link href="/search" className="text-xs font-semibold text-accent hover:underline">Browse the map</Link>}
          <Button type="button" variant="primary" size="sm" className="ml-auto h-10" onClick={onClose}>Done</Button>
        </footer>
      </div>
      <p role="status" className="sr-only">{announcement}</p>
    </dialog>
  );
}
