"use client";

import { Briefcase, GraduationCap, Home, Dumbbell, MapPin } from "lucide-react";
import type { Anchor } from "@/types";

const ICONS = {
  office: Briefcase,
  school: GraduationCap,
  family: Home,
  gym: Dumbbell,
  other: MapPin,
} as const;

export function AnchorPin({ anchor }: { anchor: Anchor }) {
  const Icon = ICONS[anchor.kind] ?? MapPin;
  return (
    <div className="group flex cursor-grab flex-col items-center active:cursor-grabbing">
      <div className="flex items-center gap-1.5 rounded-full border border-[var(--data-brass)] bg-[var(--paper-raised)] py-1 pl-1.5 pr-2.5 shadow-[var(--e2)] transition-transform duration-[160ms] [transition-timing-function:var(--ease)] group-hover:scale-105">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--data-brass)] text-white">
          <Icon size={11} strokeWidth={2} />
        </span>
        <span className="text-[11px] font-semibold tracking-tight text-ink">{anchor.label}</span>
        <span className="tnum text-[10px] text-faint">{anchor.maxKm}km</span>
      </div>
      <span className="h-2 w-px bg-[var(--data-brass)]" />
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--data-brass)] ring-2 ring-[var(--paper-raised)]" />
    </div>
  );
}
