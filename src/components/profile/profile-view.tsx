"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, Heart, History, MapPin, Scale, Trash2, Search } from "lucide-react";
import { useDiscovery } from "@/store/discovery";
import { Button } from "@/components/ui/button";
import { Img } from "@/components/ui/img";
import { Skeleton } from "@/components/ui/skeleton";
import { usePropertiesByIds } from "@/lib/hooks/use-properties";
import { useStoreHydrated } from "@/lib/hooks/use-hydrated";
import { formatPrice, formatPriceSqft } from "@/lib/format";
import type { Property } from "@/types";

type Tab = "saved" | "searches" | "anchors" | "recent" | "compare";

const TABS: { id: Tab; label: string; icon: typeof Heart }[] = [
  { id: "saved", label: "Saved homes", icon: Heart },
  { id: "searches", label: "Saved searches", icon: Bookmark },
  { id: "anchors", label: "Your anchors", icon: MapPin },
  { id: "compare", label: "Comparison", icon: Scale },
  { id: "recent", label: "Recently viewed", icon: History },
];

export function ProfileView() {
  const router = useRouter();
  const {
    savedIds, savedSearches, anchors, recentIds, compareIds,
    toggleSaved, removeSavedSearch, applySavedSearch, removeAnchor, clearCompare, setAnchorsOpen,
  } = useDiscovery();
  const [tab, setTab] = useState<Tab>("saved");
  const hydrated = useStoreHydrated();

  const counts: Record<Tab, number> = {
    saved: savedIds.length,
    searches: savedSearches.length,
    anchors: anchors.length,
    compare: compareIds.length,
    recent: recentIds.length,
  };

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-14 md:px-8">
      <header>
        <p className="eyebrow mb-2">Your PropIT</p>
        <h1 className="display text-[40px] leading-tight text-ink md:text-[52px]">
          Everything you&apos;ve kept.
        </h1>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-muted">
          Saved homes, searches and anchors live in this browser. Sign-in and sync land with accounts.
        </p>
      </header>

      <nav className="mt-10 flex gap-1 overflow-x-auto border-b border-line scroll-quiet">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-[14px] transition-colors ${
              tab === t.id
                ? "border-[var(--accent)] text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <t.icon size={14} strokeWidth={1.75} />
            {t.label}
            {hydrated && counts[t.id] > 0 && (
              <span className="tnum text-[12px] text-faint">{counts[t.id]}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-8">
        {!hydrated && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
        )}

        {hydrated && tab === "saved" && (
          <PropertyGrid
            ids={savedIds}
            empty="Nothing saved yet. Tap the heart on any home to keep it here."
            onRemove={toggleSaved}
          />
        )}

        {hydrated && tab === "recent" && (
          <PropertyGrid ids={recentIds} empty="Homes you open will appear here." />
        )}

        {hydrated && tab === "compare" && (
          <>
            <PropertyGrid ids={compareIds} empty="Add up to four homes to compare them side by side." />
            {compareIds.length > 0 && (
              <div className="mt-6 flex gap-2">
                <Link
                  href="/compare"
                  className="inline-flex h-10 items-center rounded-[var(--r-md)] bg-accent px-4 text-[14px] font-medium text-[var(--accent-ink)]"
                >
                  Compare {compareIds.length}
                </Link>
                <Button variant="ghost" size="md" onClick={clearCompare}>
                  Clear
                </Button>
              </div>
            )}
          </>
        )}

        {hydrated && tab === "searches" && (
          <>
            {savedSearches.length === 0 ? (
              <Empty
                message="No saved searches yet."
                hint="Run a search, then hit Save above the results. Anchors and radius are kept with it."
              />
            ) : (
              <ul className="divide-y divide-[var(--line)] border-y border-line">
                {savedSearches.map((s) => (
                  <li key={s.id} className="flex items-center gap-4 py-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--r-sm)] border border-line text-faint">
                      <Search size={15} strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] text-ink">{s.name}</p>
                      <p className="text-[12px] text-faint">
                        {s.anchors.length > 0 && `${s.anchors.length} anchors · `}
                        {new Date(s.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        applySavedSearch(s.id);
                        router.push("/search");
                      }}
                    >
                      Open
                    </Button>
                    <button
                      onClick={() => removeSavedSearch(s.id)}
                      className="grid h-8 w-8 place-items-center rounded-[var(--r-sm)] text-faint transition-colors hover:bg-sunk hover:text-ink"
                      aria-label={`Delete ${s.name}`}
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {hydrated && tab === "anchors" && (
          <>
            {anchors.length === 0 ? (
              <Empty
                message="No anchors set."
                hint="Anchors are the places your life happens — your office, a school, family. PropIT finds homes between them."
              />
            ) : (
              <ul className="divide-y divide-[var(--line)] border-y border-line">
                {anchors.map((a) => (
                  <li key={a.id} className="flex items-center gap-4 py-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--data-brass)] text-white">
                      <MapPin size={14} strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] text-ink">{a.label}</p>
                      <p className="tnum truncate text-[12px] text-faint">
                        {a.address} · within {a.maxKm} km
                      </p>
                    </div>
                    <button
                      onClick={() => removeAnchor(a.id)}
                      className="grid h-8 w-8 place-items-center rounded-[var(--r-sm)] text-faint transition-colors hover:bg-sunk hover:text-ink"
                      aria-label={`Remove ${a.label}`}
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="secondary"
              size="md"
              className="mt-5"
              onClick={() => {
                setAnchorsOpen(true);
                router.push("/search");
              }}
            >
              Manage on the map
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Empty({ message, hint }: { message: string; hint: string }) {
  return (
    <div className="rounded-[var(--r-md)] border border-dashed border-line-strong px-6 py-12 text-center">
      <p className="text-[15px] text-ink">{message}</p>
      <p className="mx-auto mt-2 max-w-[46ch] text-[13px] leading-relaxed text-muted">{hint}</p>
    </div>
  );
}

function PropertyGrid({
  ids, empty, onRemove,
}: {
  ids: string[];
  empty: string;
  onRemove?: (id: string) => void;
}) {
  const { data, isLoading } = usePropertiesByIds(ids);
  const items: Property[] | null = ids.length === 0 ? [] : isLoading ? null : (data?.items ?? []);

  if (items === null) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: Math.min(ids.length, 3) }).map((_, i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </div>
    );
  }

  if (!items.length) return <Empty message={empty} hint="" />;

  return (
    <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((p) => (
        <div key={p.id} className="group relative">
          <Link href={`/property/${p.slug}`} className="block">
            <Img
              src={p.images[0]?.url ?? ""}
              alt={p.title}
              seed={p.id}
              className="aspect-[16/11] w-full rounded-[var(--r-md)]"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
            <h3 className="mt-3 truncate text-[15px] font-medium text-ink transition-colors group-hover:text-accent">
              {p.title}
            </h3>
            <p className="tnum mt-1 text-[15px] font-semibold text-ink">
              {formatPrice(p.price)}
              <span className="ml-2 text-[12px] font-normal text-faint">
                {formatPriceSqft(p.pricePerSqft)}
              </span>
            </p>
          </Link>
          {onRemove && (
            <button
              onClick={() => onRemove(p.id)}
              className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-[color-mix(in_srgb,var(--paper-raised)_88%,transparent)] text-ink opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus:opacity-100"
              aria-label={`Remove ${p.title}`}
            >
              <Heart size={14} strokeWidth={1.75} fill="currentColor" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
