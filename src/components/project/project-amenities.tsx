"use client";

import { useState } from "react";
import { Building2, Check, ConciergeBell, Trees } from "lucide-react";
import { AMENITIES } from "@/lib/data/developers";

const GROUPS = [
  { id: "recreation", label: "Club & wellness", icon: Building2 },
  { id: "outdoor", label: "Sports & outdoors", icon: Trees },
  { id: "services", label: "Everyday services", icon: ConciergeBell },
] as const;

function getGroup(amenity: (typeof AMENITIES)[number] | undefined) {
  if (amenity?.slug === "sports" || amenity?.category === "Outdoor" || amenity?.category === "Family") {
    return "outdoor";
  }
  if (amenity?.category === "Recreation" || amenity?.category === "Wellness") {
    return "recreation";
  }
  return "services";
}

export function ProjectAmenities({ amenities }: { amenities: string[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const entries = [...new Set(amenities)].map((slug) => {
    const amenity = AMENITIES.find((item) => item.slug === slug);
    return { slug, name: amenity?.name ?? slug, group: getGroup(amenity) };
  });
  const groups = GROUPS.map((group) => ({
    ...group,
    items: entries.filter((entry) => entry.group === group.id),
  })).filter(({ items }) => items.length > 0);
  const active = groups.find(({ id }) => id === selectedId) ?? groups[0];

  if (!active) return <p className="mt-4 text-sm text-muted">Amenities not supplied.</p>;

  return (
    <div className="mt-5">
      <div role="group" aria-label="Amenity categories"
        className="grid gap-1.5 sm:gap-2.5" style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}>
        {groups.map(({ id, label, icon: Icon, items }) => (
          <button key={id} type="button" aria-pressed={active.id === id} onClick={() => setSelectedId(id)}
            className="flex min-h-24 min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-paper px-1.5 py-3 text-center transition-colors hover:border-accent aria-pressed:border-transparent aria-pressed:bg-inverse aria-pressed:text-ink-inverse sm:px-3">
            <Icon size={20} strokeWidth={1.65} aria-hidden="true" />
            <span className="text-xs font-semibold leading-tight">{label}</span>
            <span className="text-[11px] opacity-80">{items.length} {items.length === 1 ? "amenity" : "amenities"}</span>
          </button>
        ))}
      </div>
      <ul aria-label={active.label} className="mt-3 grid divide-y divide-line border-b border-line">
        {active.items.map(({ slug, name }) => (
          <li key={slug} className="flex items-center gap-3 px-1 py-3 text-sm">
            <Check size={15} className="shrink-0 text-accent" aria-hidden="true" />
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}
