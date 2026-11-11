"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { X, Scale, Heart, ArrowUpRight, Sparkles } from "lucide-react";
import { useDiscovery } from "@/store/discovery";
import { Img } from "@/components/ui/img";
import { QualityBadge } from "@/components/ui/badge";
import { formatArea, formatPrice, formatPriceSqft, formatRent, propertyTypeLabel, possessionLabel } from "@/lib/format";
import { fitLabel } from "@/lib/scoring/fit";
import { cn } from "@/lib/utils";

/** Floating preview that animates out of the marker, not a modal over the page. */
export function PropertyPreview({ className }: { className?: string } = {}) {
  const { previewProperty, select, toggleSaved, savedIds, toggleCompare, compareIds, setAssistantOpen } = useDiscovery();
  if (!previewProperty) return null;

  const p = previewProperty;
  const isSaved = savedIds.includes(p.id);
  const inCompare = compareIds.includes(p.id);
  const hasFit = p.fitBreakdown.length > 0;
  const fit = fitLabel(p.fitScore);
  const price = p.listingType === "rent" && p.rentMonthly ? formatRent(p.rentMonthly) : formatPrice(p.price);

  return (
    <motion.div
      layoutId={`property-${p.id}`}
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.97 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "absolute bottom-3 left-3 z-30 max-h-[min(500px,calc(100%-24px))] w-[min(340px,calc(100%-24px))] overflow-y-auto rounded-[var(--r-lg)] border border-line bg-raised shadow-[var(--e3)]",
        className,
      )}
      role="dialog"
      aria-label={p.title}
    >
      <div className="relative">
        <Img src={p.images[0]?.url ?? ""} alt={p.title} seed={p.id} className="h-40 w-full" sizes="360px" />
        <button
          onClick={() => select(null)}
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-[color-mix(in_srgb,var(--paper-raised)_88%,transparent)] text-ink backdrop-blur transition-colors hover:bg-raised"
          aria-label="Close preview"
        >
          <X size={14} strokeWidth={2} />
        </button>
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

      <div className="p-4">
        <h3 className="text-[15px] font-medium leading-snug text-ink">{p.title}</h3>
        <p className="mt-0.5 truncate text-[12px] text-muted">{p.address}</p>

        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="tnum text-[20px] font-semibold tracking-tight text-ink">{price}</span>
          <span className="tnum text-[12px] text-faint">{formatPriceSqft(p.pricePerSqft)}</span>
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
          <Sparkles size={14} /> Ask PropIT about this home
        </button>
        <div className="mt-2 flex items-center gap-1.5">
          <Link
            href={`/property/${p.slug}`}
            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[var(--r-sm)] bg-accent px-3 text-[13px] font-medium text-[var(--accent-ink)] transition-colors hover:bg-accent-hover"
          >
            View home <ArrowUpRight size={13} strokeWidth={2} />
          </Link>
          <button
            onClick={() => toggleCompare(p.id)}
            aria-pressed={inCompare}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-[var(--r-sm)] border transition-colors",
              inCompare
                ? "border-[var(--accent-line)] bg-[var(--accent-wash)] text-accent"
                : "border-line text-faint hover:text-ink",
            )}
            aria-label="Compare"
          >
            <Scale size={14} strokeWidth={1.75} />
          </button>
          <button
            onClick={() => toggleSaved(p.id)}
            aria-pressed={isSaved}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-[var(--r-sm)] border transition-colors",
              isSaved
                ? "border-[var(--accent-line)] bg-[var(--accent-wash)] text-accent"
                : "border-line text-faint hover:text-ink",
            )}
            aria-label="Save"
          >
            <Heart size={14} strokeWidth={1.75} fill={isSaved ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
