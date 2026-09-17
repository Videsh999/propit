"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Heart, Pause, Play } from "lucide-react";
import { Img } from "@/components/ui/img";
import { Reveal } from "@/components/ui/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { useProperties } from "@/lib/hooks/use-properties";
import { usePrefersReducedMotion } from "@/lib/hooks/use-media-query";
import { useDiscovery } from "@/store/discovery";
import { formatArea, formatCount, formatPrice, formatRent, bhkLabel } from "@/lib/format";
import type { ScoredProperty } from "@/types";
import { cn } from "@/lib/utils";

const BEDS = [2, 3, 4];
const BUDGETS = [
  { label: "Any", min: null, max: null },
  { label: "Under ₹1 Cr", min: null, max: 10000000 },
  { label: "₹1–2 Cr", min: 10000000, max: 20000000 },
  { label: "₹2 Cr+", min: 20000000, max: null },
] as const;

/** How long a card holds the centre before the rail moves on (3.2 seconds). */
const DWELL_MS = 3200;

/**
 * The homes, one at a time, with the next ones receding either side.
 *
 * Supports seamless infinite looping auto-advance and complete manual control:
 * - Automatically advances smoothly like an endless loop.
 * - Auto/Manual toggle button to play or pause anytime.
 * - Prev/Next navigation buttons that loop infinitely.
 * - Dot indicators to jump to any property with animated progress countdown.
 */
export function PropertyRail() {
  const railRef = useRef<HTMLUListElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  // Auto-advance state. Can be toggled manually via the Auto/Manual controls.
  const [auto, setAuto] = useState(true);
  const [inView, setInView] = useState(true);
  const [isTabVisible, setIsTabVisible] = useState(true);
  // Someone who has asked their system for reduced motion must not be given a
  // carousel that moves on its own. The manual controls still work; only the
  // unattended advance is withheld.
  const reduce = usePrefersReducedMotion();
  const isInteractingRef = useRef(false);

  // Ref for the current active index to avoid stale closures in timers
  const activeRef = useRef(0);

  // Timer reset trigger: incrementing restarts the dwell interval
  const [timerKey, setTimerKey] = useState(0);
  const resetTimer = useCallback(() => {
    setTimerKey((k) => k + 1);
  }, []);

  const filters = useDiscovery((s) => s.filters);
  const setFilters = useDiscovery((s) => s.setFilters);
  const toggleArrayFilter = useDiscovery((s) => s.toggleArrayFilter);

  const { data, isLoading } = useProperties({ limit: 12 });
  // `data?.items ?? []` is a fresh array literal on every render, which made
  // the memo below it recompute every time and re-issue a new list to every
  // consumer. Anchoring the fallback keeps the identity stable between queries.
  const items = useMemo(() => data?.items ?? [], [data?.items]);

  // Triple set for seamless infinite looping without rewinds
  const repeatedItems = useMemo(() => {
    if (items.length < 2) return items;
    return [...items, ...items, ...items];
  }, [items]);

  const goTo = useCallback((i: number, behavior: ScrollBehavior = "smooth") => {
    const rail = railRef.current;
    const el = rail?.children[i] as HTMLElement | undefined;
    if (!rail || !el) return;
    rail.scrollTo({
      left: el.offsetLeft - (rail.clientWidth - el.offsetWidth) / 2,
      behavior,
    });
  }, []);

  /** Silently reset scroll position to the identical card in the middle set */
  const normalizeTo = useCallback((targetIdx: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const el = rail.children[targetIdx] as HTMLElement | undefined;
    if (!el) return;
    const targetLeft = el.offsetLeft - (rail.clientWidth - el.offsetWidth) / 2;
    rail.style.scrollSnapType = "none";
    rail.scrollTo({ left: targetLeft, behavior: "instant" });
    activeRef.current = targetIdx;
    setActive(targetIdx);
    requestAnimationFrame(() => {
      if (railRef.current) {
        railRef.current.style.scrollSnapType = "";
      }
    });
  }, []);

  /** Whichever card's centre is nearest the rail's centre is the one in focus. */
  const syncActive = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const mid = rail.scrollLeft + rail.clientWidth / 2;
    let best = 0;
    let bestGap = Infinity;
    Array.from(rail.children).forEach((child, i) => {
      const el = child as HTMLElement;
      const gap = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
      if (gap < bestGap) {
        bestGap = gap;
        best = i;
      }
    });
    activeRef.current = best;
    setActive(best);
  }, []);

  // Scroll listener with settle detection for seamless infinite normalization
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    let frame = 0;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const checkSettleAndNormalize = () => {
      if (isInteractingRef.current || items.length < 2) return;
      const cur = activeRef.current;
      const n = items.length;
      if (cur >= 2 * n) {
        normalizeTo(cur - n);
      } else if (cur < n) {
        normalizeTo(cur + n);
      }
    };

    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncActive);

      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(checkSettleAndNormalize, 160);
    };

    rail.addEventListener("scroll", onScroll, { passive: true });
    rail.addEventListener("scrollend", checkSettleAndNormalize);

    syncActive();

    return () => {
      cancelAnimationFrame(frame);
      if (settleTimer) clearTimeout(settleTimer);
      rail.removeEventListener("scroll", onScroll);
      rail.removeEventListener("scrollend", checkSettleAndNormalize);
    };
  }, [syncActive, normalizeTo, items.length]);

  /** Move forward or backward in an infinite loop */
  const navigate = useCallback(
    (dir: "next" | "prev") => {
      const rail = railRef.current;
      const n = items.length;
      if (!rail || n < 2) return;

      let cur = activeRef.current;
      // If outside middle range, normalize position instantly first
      if (cur >= 2 * n) {
        normalizeTo(cur - n);
        cur -= n;
      } else if (cur < n) {
        normalizeTo(cur + n);
        cur += n;
      }

      const target = dir === "next" ? cur + 1 : cur - 1;
      activeRef.current = target;
      setActive(target);
      goTo(target, "smooth");
    },
    [items.length, goTo, normalizeTo]
  );

  /**
   * Open one card in, positioned in the middle set.
   * Re-runs whenever the query / items signature changes.
   */
  const settledAt = useRef<string | null>(null);
  const signature = items.map((p) => p.id).join(",");
  useEffect(() => {
    if (!items.length || settledAt.current === signature) return;
    settledAt.current = signature;
    const n = items.length;
    const start = n >= 2 ? n + (n >= 3 ? 1 : 0) : 0;
    activeRef.current = start;
    setActive(start);
    const raf = requestAnimationFrame(() => {
      goTo(start, "instant");
    });
    return () => cancelAnimationFrame(raf);
  }, [signature, items.length, goTo]);

  /** Re-align to active card if the window is resized */
  useEffect(() => {
    const onResize = () => {
      goTo(activeRef.current, "instant");
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [goTo]);

  /** Run the carousel whenever any part is on screen */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        setInView(e.isIntersecting);
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /** Suspend auto-scroll when the document/tab is hidden */
  useEffect(() => {
    const onVisibility = () => {
      setIsTabVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  /**
   * Automatic scrolling: advances smoothly to the next property in a loop.
   *
   * `reduce` is first for a reason — it is the one condition no amount of
   * interaction should be able to switch back on.
   */
  useEffect(() => {
    if (reduce || !auto || !inView || !isTabVisible || items.length < 2) return;
    const id = window.setInterval(() => {
      if (!isInteractingRef.current) {
        navigate("next");
      }
    }, DWELL_MS);
    return () => window.clearInterval(id);
  }, [reduce, auto, inView, isTabVisible, items.length, navigate, timerKey]);

  /** Manual navigation handlers */
  const handleManualNav = useCallback(
    (dir: "next" | "prev") => {
      resetTimer();
      navigate(dir);
    },
    [navigate, resetTimer]
  );

  const handleDotClick = useCallback(
    (i: number) => {
      resetTimer();
      const n = items.length;
      if (n < 2) {
        goTo(i, "smooth");
        return;
      }
      const target = n + i;
      activeRef.current = target;
      setActive(target);
      goTo(target, "smooth");
    },
    [items.length, goTo, resetTimer]
  );

  const toggleAuto = useCallback(() => {
    setAuto((prev) => !prev);
    resetTimer();
  }, [resetTimer]);

  const onPointerDown = useCallback(() => {
    isInteractingRef.current = true;
    resetTimer();
  }, [resetTimer]);

  const onPointerUp = useCallback(() => {
    isInteractingRef.current = false;
    resetTimer();
  }, [resetTimer]);

  const realActive = items.length > 0 ? ((active % items.length) + items.length) % items.length : 0;

  return (
    <section
      ref={sectionRef}
      className="overflow-hidden border-t border-line py-20 md:py-24"
    >
      <div className="mx-auto max-w-[1440px] px-5 md:px-8">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow mb-3">
                {isLoading ? "Searching" : `${formatCount(data?.total ?? 0)} homes match`}
              </p>
              <h2 className="display text-[32px] leading-[1.05] text-ink md:text-[42px]">
                More homes worth seeing.
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={toggleAuto}
                  aria-label={auto ? "Switch to manual mode" : "Enable auto-scroll loop"}
                  title={auto ? "Auto-scroll is active (click to pause)" : "Auto-scroll paused (click to start)"}
                  className={cn(
                    "group flex h-10 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-all duration-[160ms]",
                    auto
                      ? "border-[var(--accent)] bg-[var(--accent-wash)] text-accent hover:border-[var(--accent-hover)]"
                      : "border-line-strong bg-raised text-muted hover:border-ink hover:text-ink",
                  )}
                >
                  {auto ? (
                    <>
                      <Pause size={13} strokeWidth={2.2} className="text-accent" />
                      <span className="hidden sm:inline">Auto</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" aria-hidden />
                    </>
                  ) : (
                    <>
                      <Play size={13} strokeWidth={2.2} className="translate-x-0.5 text-muted group-hover:text-ink" />
                      <span className="hidden sm:inline">Manual</span>
                    </>
                  )}
                </button>
              )}

              <RailButton
                dir="prev"
                disabled={items.length <= 1}
                onClick={() => handleManualNav("prev")}
              />
              <RailButton
                dir="next"
                disabled={items.length <= 1}
                onClick={() => handleManualNav("next")}
              />
            </div>
          </div>
        </Reveal>

        {/* Filters. Deliberately few — the full set lives on the map. */}
        <Reveal delay={0.05}>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-line py-4">
            <Segment
              options={[
                { label: "Buy", on: filters.listingType === "buy" },
                { label: "Rent", on: filters.listingType === "rent" },
              ]}
              onPick={(i) =>
                setFilters({
                  listingType: i === 0 ? "buy" : "rent",
                  priceMin: null,
                  priceMax: null,
                })
              }
            />

            <span className="h-5 w-px bg-[var(--line)]" aria-hidden />

            <div className="flex flex-wrap gap-1.5">
              {BEDS.map((b) => (
                <Chip
                  key={b}
                  on={filters.bedrooms.includes(b)}
                  onClick={() => toggleArrayFilter("bedrooms", b)}
                >
                  {b === 4 ? "4 BHK+" : bhkLabel(b)}
                </Chip>
              ))}
            </div>

            <span className="hidden h-5 w-px bg-[var(--line)] sm:block" aria-hidden />

            <div className="flex flex-wrap gap-1.5">
              {BUDGETS.map((b) => (
                <Chip
                  key={b.label}
                  on={filters.priceMin === b.min && filters.priceMax === b.max}
                  onClick={() => setFilters({ priceMin: b.min, priceMax: b.max })}
                >
                  {b.label}
                </Chip>
              ))}
            </div>
          </div>
        </Reveal>
      </div>

      {isLoading && items.length === 0 && <RailSkeleton />}

      {!isLoading && items.length === 0 && (
        <p className="mx-auto mt-12 max-w-[1440px] px-5 text-[14px] text-muted md:px-8">
          Nothing matches those filters. Widen the budget, or clear a bedroom count.
        </p>
      )}

      {items.length > 0 && (
        <>
          {/* Full-bleed: the receding neighbours must be free to run off the
              page, which is the whole signal that there are more of them. */}
          <ul
            ref={railRef}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onTouchStart={onPointerDown}
            onTouchEnd={onPointerUp}
            className="scroll-quiet mt-12 flex snap-x snap-mandatory items-center gap-6 overflow-x-auto px-[max(1.25rem,calc((100vw-min(78vw,560px))/2))] pb-6 md:gap-10"
            aria-label="More homes"
          >
            {repeatedItems.map((p, i) => {
              const setIndex = items.length > 0 ? Math.floor(i / items.length) : 0;
              return (
                <PropertySlide
                  key={`${p.id}-set-${setIndex}`}
                  property={p}
                  offset={i - active}
                  active={i === active}
                  onFocusCard={() => {
                    resetTimer();
                    activeRef.current = i;
                    setActive(i);
                    goTo(i, "smooth");
                  }}
                />
              );
            })}
          </ul>

          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-4 px-5 md:px-8">
            <Link
              href="/search"
              onClick={() => useDiscovery.getState().setViewMode("split")}
              className="group inline-flex items-center gap-1.5 text-[15px] text-ink transition-colors hover:text-accent"
            >
              View all homes
              <ArrowRight
                size={15}
                strokeWidth={2}
                className="text-accent transition-transform duration-[180ms] group-hover:translate-x-0.5"
              />
            </Link>

            <div className="flex items-center gap-3 sm:gap-4">
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={toggleAuto}
                  aria-label={auto ? "Pause auto-scroll" : "Resume auto-scroll"}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-line bg-raised px-2.5 py-1 text-[12px] font-medium text-muted transition-colors hover:border-line-strong hover:text-ink"
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-colors",
                      auto ? "bg-emerald-500 animate-pulse" : "bg-neutral-400",
                    )}
                    aria-hidden
                  />
                  <span>{auto ? "Auto-scroll" : "Manual"}</span>
                  {auto ? (
                    <Pause size={10} strokeWidth={2.5} className="text-muted group-hover:text-ink" />
                  ) : (
                    <Play size={10} strokeWidth={2.5} className="text-muted group-hover:text-ink" />
                  )}
                </button>
              )}

              <div className="flex items-center gap-1.5" role="tablist" aria-label="Choose a home">
                {items.map((p, i) => {
                  const isActive = i === realActive;
                  return (
                    <button
                      key={p.id}
                      role="tab"
                      aria-selected={isActive}
                      aria-label={p.title}
                      onClick={() => handleDotClick(i)}
                      className={cn(
                        "relative h-[4px] rounded-full overflow-hidden transition-[width,background-color] duration-[260ms] [transition-timing-function:var(--ease)]",
                        isActive ? "w-8 bg-[var(--line-strong)]" : "w-3 bg-[var(--line-strong)] hover:bg-ink/40",
                      )}
                    >
                      {isActive && auto && (
                        <span
                          key={`progress-${realActive}-${timerKey}`}
                          className="absolute inset-y-0 left-0 bg-[var(--accent)] rounded-full"
                          style={{
                            animation: `progress ${DWELL_MS}ms linear forwards`,
                          }}
                        />
                      )}
                      {isActive && !auto && (
                        <span className="absolute inset-0 bg-[var(--accent)] rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Depth by distance from the centre.
 *
 * Two steps of falloff rather than a continuous curve: a card is the one you
 * are looking at, the one beside it, or further away. More gradations would be
 * motion for its own sake.
 */
function depth(offset: number) {
  const d = Math.abs(offset);
  if (d === 0) return { scale: 1, opacity: 1 };
  if (d === 1) return { scale: 0.88, opacity: 0.5 };
  return { scale: 0.8, opacity: 0.22 };
}

/**
 * The locality, read back out of the address.
 *
 * Addresses are built as `[project, ]locality, corridor Hyderabad`, so the
 * locality is always the penultimate segment. Parsing it back is cheaper than
 * shipping a locality lookup to the client for one line of eyebrow text.
 */
function localityFrom(address: string): string {
  const parts = address.split(",").map((s) => s.trim());
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
}

/**
 * A card that behaves like a map marker.
 *
 * Choosing the focused home selects it, moves the camera to it and returns the
 * page to the map — the card and the marker are two views of one object, so
 * picking either should put you in the same place. Choosing a card that is
 * *not* focused just brings it to the centre, because clicking a half-faded
 * card at the edge of the rail means "let me see that one", not "take me away".
 */
function PropertySlide({
  property: p,
  offset,
  active,
  onFocusCard,
}: {
  property: ScoredProperty;
  offset: number;
  active: boolean;
  onFocusCard: () => void;
}) {
  const select = useDiscovery((s) => s.select);
  const flyTo = useDiscovery((s) => s.flyTo);
  const hover = useDiscovery((s) => s.hover);
  const toggleSaved = useDiscovery((s) => s.toggleSaved);
  const saved = useDiscovery((s) => s.savedIds).includes(p.id);

  const { scale, opacity } = depth(offset);
  const price =
    p.listingType === "rent" && p.rentMonthly ? formatRent(p.rentMonthly) : formatPrice(p.price);

  function reveal() {
    select(p.id, p);
    flyTo(p.location, 15);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <li
      className="w-[min(78vw,560px)] shrink-0 snap-center transition-[opacity,transform] duration-[420ms] [transition-timing-function:var(--ease)]"
      style={{ opacity, transform: `scale(${scale})` }}
      onMouseEnter={() => active && hover(p.id)}
      onMouseLeave={() => hover(null)}
      aria-hidden={!active}
    >
      <article className="group">
        <div className="relative overflow-hidden rounded-[var(--r-lg)] border border-line">
          <button
            onClick={active ? reveal : onFocusCard}
            tabIndex={active ? 0 : -1}
            className="block w-full text-left"
            aria-label={active ? `Show ${p.title} on the map` : `Bring ${p.title} into focus`}
          >
            <Img
              src={p.images[0]?.url ?? ""}
              alt={p.title}
              seed={p.id}
              sizes="(max-width: 768px) 78vw, 560px"
              className="aspect-[4/3] w-full transition-transform duration-[700ms] [transition-timing-function:var(--ease)] group-hover:scale-[1.02]"
            />
          </button>

          {/* Only the focused card offers actions — a rail of competing save
              buttons is noise, and the others are half off-screen anyway. */}
          <button
            onClick={() => toggleSaved(p.id)}
            tabIndex={active ? 0 : -1}
            aria-pressed={saved}
            aria-label={saved ? `Remove ${p.title} from your shortlist` : `Save ${p.title}`}
            className={cn(
              "absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-[color-mix(in_srgb,var(--paper-raised)_88%,transparent)] backdrop-blur transition-[background-color,opacity] duration-[300ms] hover:bg-raised",
              active ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <Heart
              size={15}
              strokeWidth={1.75}
              className={cn(saved ? "fill-[var(--data-clay)] text-[var(--data-clay)]" : "text-ink")}
            />
          </button>
        </div>

        <div className="mt-5 px-1">
          <p className="eyebrow">{localityFrom(p.address)}</p>
          <h3 className="display mt-2 text-[26px] leading-tight text-ink md:text-[32px]">
            <Link
              href={`/property/${p.slug}`}
              tabIndex={active ? 0 : -1}
              className="transition-colors hover:text-accent"
            >
              {p.title}
            </Link>
          </h3>

          <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-line pt-4">
            <span className="tnum text-[26px] font-semibold text-ink">{price}</span>
            <span className="tnum text-[14px] text-muted">
              {bhkLabel(p.bedrooms)} · {formatArea(p.builtupAreaSqft)}
            </span>
            {p.isVerified && (
              <span className="eyebrow ml-auto text-[9px] text-accent">Verified</span>
            )}
          </div>

          <div
            className={cn(
              "mt-4 transition-opacity duration-[300ms]",
              active ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <Link
              href={`/property/${p.slug}`}
              tabIndex={active ? 0 : -1}
              className="group/link inline-flex items-center gap-1.5 text-[15px] text-ink transition-colors hover:text-accent"
            >
              View property
              <ArrowRight
                size={14}
                strokeWidth={2}
                className="text-accent transition-transform duration-[180ms] group-hover/link:translate-x-0.5"
              />
            </Link>
          </div>
        </div>
      </article>
    </li>
  );
}

/**
 * The rail before the first query lands.
 *
 * Shaped like the carousel rather than like a row of equal cards — including
 * the depth falloff — so the section does not visibly re-lay-out the moment the
 * homes arrive.
 */
function RailSkeleton() {
  return (
    <ul
      aria-hidden
      className="mt-12 flex items-center gap-6 overflow-hidden px-[max(1.25rem,calc((100vw-min(78vw,560px))/2))] pb-6 md:gap-10"
    >
      {[1, 0, 1].map((d, i) => (
        <li
          key={i}
          className="w-[min(78vw,560px)] shrink-0"
          style={{ opacity: depth(d).opacity, transform: `scale(${depth(d).scale})` }}
        >
          <Skeleton className="aspect-[4/3] w-full rounded-[var(--r-lg)]" />
          <Skeleton className="mt-5 h-3 w-24" />
          <Skeleton className="mt-3 h-7 w-3/5" />
          <Skeleton className="mt-4 h-6 w-2/5" />
        </li>
      ))}
    </ul>
  );
}

function Segment({
  options,
  onPick,
}: {
  options: { label: string; on: boolean }[];
  onPick: (i: number) => void;
}) {
  return (
    <div className="flex items-center gap-5">
      {options.map((o, i) => (
        <button
          key={o.label}
          onClick={() => onPick(i)}
          aria-pressed={o.on}
          className={cn(
            "border-b-2 pb-1 text-[15px] font-medium transition-colors duration-[160ms]",
            o.on ? "border-[var(--accent)] text-ink" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "h-8 rounded-[var(--r-sm)] border px-3 text-[13px] transition-colors duration-[160ms]",
        on
          ? "border-[var(--accent)] bg-accent text-[var(--accent-ink)]"
          : "border-line bg-raised text-ink hover:border-line-strong",
      )}
    >
      {children}
    </button>
  );
}

function RailButton({
  dir,
  disabled,
  onClick,
}: {
  dir: "prev" | "next";
  disabled?: boolean;
  onClick: () => void;
}) {
  const Icon = dir === "prev" ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Previous home" : "Next home"}
      className={cn(
        "grid h-10 w-10 place-items-center rounded-full border transition-colors duration-[160ms]",
        disabled
          ? "border-line text-faint opacity-50 cursor-not-allowed"
          : "border-line-strong bg-raised text-ink hover:border-[var(--accent)] hover:text-accent",
      )}
    >
      <Icon size={15} strokeWidth={1.75} />
    </button>
  );
}

