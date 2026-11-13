"use client";

import Link, { useLinkStatus } from "next/link";
import { motion } from "motion/react";
import { X, Heart, ArrowUpRight, MessageCircle } from "lucide-react";
import { useDiscovery } from "@/store/discovery";
import { CompareToggle } from "@/components/compare/compare-toggle";
import { Img } from "@/components/ui/img";
import { QualityBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatArea, formatPrice, formatPriceSqft, formatRent, propertyTypeLabel, possessionLabel } from "@/lib/format";
import { fitLabel } from "@/lib/scoring/fit";
import { cn } from "@/lib/utils";

/** Floating preview that animates out of the marker, not a modal over the page. */
export function PropertyPreview({ className, error = false, onRetry }: {
  className?: string; error?: boolean; onRetry?: () => void;
} = {}) {
  const { previewProperty, select, toggleSaved, savedIds, setAssistantOpen } = useDiscovery();
  const p = previewProperty;
  const panelClass = cn(
    "absolute bottom-3 left-3 z-30 flex max-h-[min(500px,calc(100%-24px))] w-[min(340px,calc(100%-24px))] flex-col overflow-hidden rounded-[var(--r-lg)] border border-line bg-raised shadow-[var(--e3)]",
    className,
  );
  const close = (
    <button type="button" onClick={() => select(null)}
      className="absolute right-2 top-2 z-10 grid size-9 place-items-center rounded-full border border-line bg-raised text-ink shadow-e1 hover:bg-sunk"
      aria-label="Close preview">
      <X size={16} strokeWidth={2} />
    </button>
  );
  if (!p) {
    return (
      <aside className={panelClass} aria-label="Property preview">
        {close}
        <div role="status" className="p-4 pr-14 text-sm text-muted">
          {error ? <>Couldn’t open this property.{" "}
            <button type="button" onClick={onRetry} className="font-semibold text-accent underline">Try again</button>
          </> : <>Loading property…<Skeleton className="mt-2 h-4 w-4/5" /></>}
        </div>
      </aside>
    );
  }
  const isSaved = savedIds.includes(p.id);
  const hasFit = p.fitBreakdown.length > 0;
  const fit = fitLabel(p.fitScore);
  const price = p.listingType === "rent" ? p.rentMonthly == null ? "Rent on request" : formatRent(p.rentMonthly) : formatPrice(p.price);
  const href = `/property/${p.slug}`;

  return (
    <motion.div
      layoutId={`property-${p.id}`}
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.97 }}
      transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className={panelClass}
      role="dialog"
      aria-label={p.title}
    >
      {close}
      <div className="scroll-quiet min-h-0 overflow-y-auto overscroll-contain">
        <div className="relative">
          <Link href={href} onNavigate={() => select(null)} aria-label={`Open ${p.title}`} className="block">
            <Img src={p.images[0]?.url ?? ""} alt="" seed={p.id} className="h-28 w-full sm:h-36" sizes="340px" />
          </Link>
          {hasFit && (
            <span
              className={cn(
                "tnum absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold backdrop-blur",
                fit.tone === "strong"
                  ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                  : "bg-[color-mix(in_srgb,var(--paper-raised)_88%,transparent)] text-ink",
              )}
            >
              {p.fitScore} · {fit.label}
            </span>
          )}
        </div>

        <div className="px-4 pb-3 pt-3">
          <h3 className="text-[15px] font-semibold leading-snug text-ink">
            <Link href={href} onNavigate={() => select(null)} className="hover:text-accent hover:underline">{p.title}</Link>
          </h3>
          <p className="mt-0.5 truncate text-[12px] text-muted">{p.address}</p>

          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="tnum text-[20px] font-semibold tracking-tight text-ink">{price}</span>
            {p.listingType === "buy" && <span className="tnum text-[12px] text-faint">{formatPriceSqft(p.pricePerSqft)}</span>}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
            {p.bedrooms > 0 && <span>{p.bedrooms} BHK</span>}
            {p.bathrooms > 0 && <span>· {p.bathrooms} bath</span>}
            <span>· {formatArea(p.builtupAreaSqft)}</span>
            <span>· {propertyTypeLabel(p.propertyType)}</span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <QualityBadge quality={p.dataQuality} />
            <span className="text-[11px] text-faint">{possessionLabel(p.possession)}</span>
          </div>

          {hasFit && (
            <ul className="mt-3 space-y-1 border-t border-line pt-2.5">
              {p.fitBreakdown.map((b) => (
                <li key={b.anchorId} className="flex items-baseline justify-between text-[12px]">
                  <span className="text-muted">{b.label}</span>
                  <span className="tnum text-ink">
                    {b.distanceKm} km{" "}
                    <span className="text-faint">
                      · ~{b.minutes} min <span className="text-[10px]">est.</span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={() => setAssistantOpen(true)}
            className="mt-3 inline-flex min-h-8 items-center gap-1.5 text-[13px] font-semibold text-accent hover:underline"
          >
            <MessageCircle size={14} /> Ask PropIT about this home
          </button>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 border-t border-line bg-raised px-3 py-2.5">
        <Link
          href={href}
          prefetch={true}
          className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[var(--r-sm)] bg-accent px-2 text-center text-[13px] font-semibold text-[var(--accent-ink)] transition-colors hover:bg-accent-hover"
        >
            <FullPropertyLinkLabel />
        </Link>
        <CompareToggle id={p.id} compact className="size-11" />
        <button
          onClick={() => toggleSaved(p.id)}
          aria-pressed={isSaved}
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-[var(--r-sm)] border transition-colors",
            isSaved
              ? "border-[var(--accent-line)] bg-[var(--accent-wash)] text-accent"
              : "border-line text-faint hover:text-ink",
          )}
          aria-label="Save"
        >
          <Heart size={14} strokeWidth={1.75} fill={isSaved ? "currentColor" : "none"} />
        </button>
      </div>
    </motion.div>
  );
}

function FullPropertyLinkLabel() {
  const { pending } = useLinkStatus();
  return <>
    <span aria-live="polite">{pending ? "Opening property…" : "View full property"}</span>
    <ArrowUpRight size={14} className="shrink-0" strokeWidth={2} aria-hidden="true" />
  </>;
}
