"use client";

import { Scale } from "lucide-react";
import { useDiscovery, MAX_COMPARE_PROPERTIES } from "@/store/discovery";
import { cn } from "@/lib/utils";

export function CompareToggle({ id, compact = false, className }: { id: string; compact?: boolean; className?: string }) {
  const selected = useDiscovery((state) => state.compareIds.includes(id));
  const full = useDiscovery((state) => state.compareIds.length >= MAX_COMPARE_PROPERTIES);
  const toggle = useDiscovery((state) => state.toggleCompare);
  const atLimit = full && !selected;
  const label = selected ? "Remove from comparison" : atLimit ? "Comparison full. Remove a property to add another." : "Add to comparison";

  return (
    <button type="button" aria-pressed={selected} aria-disabled={atLimit} aria-label={label} title={label}
      onClick={(event) => {
        event.stopPropagation();
        if (!atLimit) toggle(id);
      }}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[var(--r-sm)] border px-2 text-xs transition-colors",
        selected ? "border-[var(--accent-line)] bg-accent-wash text-accent" : "border-line bg-raised text-muted hover:text-ink",
        atLimit && "cursor-not-allowed opacity-50", className,
      )}>
      <Scale size={14} aria-hidden="true" />
      {!compact && (selected ? "Added" : "Compare")}
    </button>
  );
}
