import { BadgeCheck, CircleDashed, FileCheck2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DataQuality } from "@/types";

/**
 * Data-quality badge. Verified, listed and estimated must never look alike —
 * the visual difference is the honesty guarantee.
 */
export function QualityBadge({
  quality,
  className,
  label,
}: {
  quality: DataQuality;
  className?: string;
  label?: string;
}) {
  const map = {
    verified: {
      icon: BadgeCheck,
      text: label ?? "Verified",
      cls: "text-[var(--accent)] bg-[var(--accent-wash)] border-[var(--accent-line)]",
    },
    listed: {
      icon: FileCheck2,
      text: label ?? "Listed",
      cls: "text-muted bg-sunk border-line",
    },
    estimated: {
      icon: CircleDashed,
      text: label ?? "Estimated",
      cls: "text-faint bg-transparent border-dashed border-line",
    },
  } as const;
  const { icon: Icon, text, cls } = map[quality];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        cls,
        className,
      )}
    >
      <Icon size={12} strokeWidth={1.75} />
      {text}
    </span>
  );
}

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--r-sm)] border border-line bg-raised px-2 py-0.5 text-[11px] font-medium text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
