"use client";

import { useState } from "react";
import { Building2, ConciergeBell, Trees } from "lucide-react";
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
        {groups.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" aria-pressed={active.id === id} onClick={() => setSelectedId(id)}
            className="flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-line bg-raised px-1.5 py-4 text-center text-muted transition-colors hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink sm:px-3">
            <Icon size={20} strokeWidth={1.65} aria-hidden="true" />
            <span className="text-xs font-semibold leading-tight">{label}</span>
          </button>
        ))}
      </div>
      <ol aria-label={active.label} className="mt-4 grid gap-x-6 sm:grid-cols-2">
        {active.items.map(({ slug, name }, index) => (
          <li key={slug} className="flex min-h-16 items-center gap-4 border-b border-line px-1 py-3 text-base">
            <span className="tnum text-xs text-faint" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            {name}
          </li>
        ))}
      </ol>
    </div>
  );
}
