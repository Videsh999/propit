"use client";

import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
import { useDiscovery } from "@/store/discovery";
import { useStoreHydrated } from "@/lib/hooks/use-hydrated";
import { usePropertiesByIds } from "@/lib/hooks/use-properties";
import { Img } from "@/components/ui/img";
import { formatPrice, bhkLabel } from "@/lib/format";

/**
 * The shortlist, wherever the user got to with it.
 *
 * Saved homes are the one piece of state that survives a visit, so the page
 * should acknowledge them rather than making the user go looking. With nothing
 * saved it is one quiet line explaining what the heart icon is for — an empty
 * state that teaches, not a placeholder that apologises.
 *
 * Renders only after hydration: the list lives in localStorage, and rendering
 * a count on the server that the client immediately contradicts is a mismatch.
 */
export function Shortlist() {
  const hydrated = useStoreHydrated();
  const savedIds = useDiscovery((s) => s.savedIds);
  const { data } = usePropertiesByIds(hydrated ? savedIds.slice(0, 4) : []);
  const items = data?.items ?? [];

  if (!hydrated) return null;

  const empty = savedIds.length === 0;

  return (
    <section className="border-t border-line px-5 py-14 md:px-8 md:py-16">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-8">
        <div className="flex items-center gap-5">
          {empty ? (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line text-faint">
              <Heart size={17} strokeWidth={1.75} />
            </span>
          ) : (
            <ul className="flex shrink-0 -space-x-4">
              {items.slice(0, 4).map((p) => (
                <li key={p.id}>
                  <Img
                    src={p.images[0]?.url ?? ""}
                    alt=""
                    seed={p.id}
                    sizes="56px"
                    className="h-12 w-12 rounded-full ring-2 ring-[var(--paper)]"
                  />
                </li>
              ))}
            </ul>
          )}

          <div>
            <h2 className="text-[19px] font-medium text-ink md:text-[21px]">
              {empty ? "Build your shortlist." : "Your shortlist."}
            </h2>
            <p className="mt-1 max-w-[52ch] text-[14px] leading-relaxed text-muted">
              {empty ? (
                "Save homes as you go and PropIT will keep them side by side — with the distances that made you look twice."
              ) : (
                <>
                  <span className="tnum font-medium text-ink">{savedIds.length}</span>{" "}
                  {savedIds.length === 1 ? "home" : "homes"} saved
                  {items[0] && (
                    <span className="text-faint">
                      {" "}
                      · from {formatPrice(Math.min(...items.map((p) => p.price)))} ·{" "}
                      {bhkLabel(items[0].bedrooms)} and up
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
        </div>

        <Link
          href={empty ? "/search" : "/compare"}
          className="group inline-flex h-11 shrink-0 items-center gap-2 rounded-[var(--r-pill)] border border-line-strong px-5 text-[15px] font-medium text-ink transition-colors duration-[160ms] hover:border-[var(--accent)]"
        >
          {empty ? "Start saving homes" : "Compare them side by side"}
          <ArrowRight
            size={15}
            strokeWidth={2}
            className="text-accent transition-transform duration-[180ms] group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </section>
  );
}
