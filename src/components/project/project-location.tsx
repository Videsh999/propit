"use client";

import { useState } from "react";
import { BriefcaseBusiness, CarFront, GraduationCap, HeartPulse, MapPin, Trees } from "lucide-react";
import { formatDistance, formatMinutes } from "@/lib/format";
import type { LatLng, NearbyPlace, PoiCategory } from "@/types";

const CATEGORIES: { id: string; label: string; icon: typeof CarFront; types: PoiCategory[] }[] = [
  { id: "connectivity", label: "Connectivity", icon: CarFront, types: ["metro", "railway", "airport"] },
  { id: "work", label: "Work", icon: BriefcaseBusiness, types: ["office_hub"] },
  { id: "schools", label: "Schools", icon: GraduationCap, types: ["school"] },
  { id: "healthcare", label: "Healthcare", icon: HeartPulse, types: ["hospital"] },
  { id: "leisure", label: "Leisure", icon: Trees, types: ["mall", "park", "stadium"] },
];

type Destination = Pick<NearbyPlace, "id" | "name" | "location" | "category" | "distanceKm" | "minutes"> & { kind: string };

export function ProjectLocation({ name, origin, places }: {
  name: string;
  origin: LatLng;
  places: Destination[];
}) {
  const [categoryId, setCategoryId] = useState("connectivity");
  const [placeId, setPlaceId] = useState<string | null>(null);
  const categories = CATEGORIES.map((category) => {
    const matches = places.filter(({ category: type }) => category.types.includes(type));
    const airport = matches.find(({ category: type }) => type === "airport");
    const nearby = matches.filter((place) => place !== airport).slice(0, airport ? 4 : 5);
    return {
      ...category,
      places: (airport ? [...nearby, airport] : nearby).sort((a, b) => a.minutes - b.minutes),
    };
  }).filter((category) => category.places.length > 0);
  const active = categories.find(({ id }) => id === categoryId) ?? categories[0];
  const selected = active?.places.find(({ id }) => id === placeId) ?? active?.places[0];

  if (!active || !selected) return <p className="mt-5 text-sm text-muted">Nearby destinations aren’t available for this project.</p>;

  return (
    <div className="mt-5">
      <div role="group" aria-label="Nearby categories" className="flex gap-1.5 overflow-x-auto pb-2">
        {categories.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" aria-pressed={active.id === id}
            onClick={() => { setCategoryId(id); setPlaceId(null); }}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-line bg-paper px-3 text-xs font-semibold transition-colors hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent-wash aria-pressed:text-accent">
            <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      <div className="grid min-w-0 gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(280px,1fr)]">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2 border-b border-line px-2 py-2 text-xs font-medium text-muted">
            <span>{active.label}</span>
            <span>Est. drive</span>
          </div>
          <ul aria-label={`${active.label} destinations`} className="divide-y divide-line border-b border-line">
            {active.places.map((place) => (
              <li key={place.id}>
                <button type="button" aria-pressed={place.id === selected.id} onClick={() => setPlaceId(place.id)}
                  className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-paper aria-pressed:bg-accent-wash sm:px-3">
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-semibold leading-snug">{place.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">{place.kind} · {formatDistance(place.distanceKm)}</span>
                  </span>
                  <span className="tnum whitespace-nowrap text-sm font-semibold text-accent">~{formatMinutes(Math.max(1, place.minutes))}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 px-2 text-xs leading-relaxed text-muted">Times are estimated from straight-line distance and don’t account for traffic.</p>
        </div>
        <TravelDiagram name={name} origin={origin} places={active.places} selected={selected} onSelect={setPlaceId} />
      </div>
    </div>
  );
}

function TravelDiagram({ name, origin, places, selected, onSelect }: {
  name: string;
  origin: LatLng;
  places: Destination[];
  selected: Destination;
  onSelect: (id: string) => void;
}) {
  const longest = Math.max(...places.map(({ minutes }) => minutes));
  const ceiling = [12, 20, 32, 40, 60, 80, 120].find((limit) => limit >= longest) ?? Math.ceil(longest / 40) * 40;
  const radius = (minutes: number) => 39 * Math.sqrt(minutes / ceiling);
  const points = places.map((place) => {
    const dx = (place.location.lng - origin.lng) * Math.cos(origin.lat * Math.PI / 180);
    const dy = place.location.lat - origin.lat;
    const bearing = Math.atan2(dy, dx);
    const r = radius(Math.max(1, place.minutes));
    return { place, x: 50 + r * Math.cos(bearing), y: 50 - r * Math.sin(bearing) };
  });

  return (
    <figure className="min-w-0 self-start rounded-xl border border-[#344a3e] bg-[#1b3128] px-3 pb-3 pt-3 text-[#fffaf0]">
      <figcaption className="flex items-center justify-between gap-2 px-1 text-xs font-semibold">
        <span>Drive time from {name}</span>
        <span aria-hidden="true" className="shrink-0 text-[11px] text-[#bbc9be]">↑ N</span>
      </figcaption>
      <div className="relative mx-auto aspect-square max-w-[310px]">
        <svg aria-hidden="true" className="absolute inset-0 size-full" viewBox="0 0 100 100">
          <path d="M 50 8 V 92 M 8 50 H 92" fill="none" stroke="#365447" strokeWidth=".2" />
          {[ceiling, ceiling / 2, ceiling / 4].map((time) => (
            <g key={time}>
              <circle cx="50" cy="50" r={radius(time)} fill="none" stroke="#759485" strokeWidth=".28" strokeDasharray=".45 1.2" />
              <text x="52" y={49 - radius(time)} fill="#bbc9be" fontSize="3.1">{time} min</text>
            </g>
          ))}
          {points.map(({ place, x, y }) => (
            <path key={place.id} d={`M 50 50 L ${x} ${y}`} fill="none"
              stroke={place.id === selected.id ? "#f4ce83" : "#819e8e"} strokeWidth={place.id === selected.id ? ".55" : ".25"} />
          ))}
        </svg>
        <span className="pointer-events-none absolute left-1/2 top-1/2 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#f4ce83]/50 bg-[#1b3128] text-[#f4ce83]" aria-hidden="true">
          <MapPin size={14} />
        </span>
        {points.map(({ place, x, y }) => (
          <button key={place.id} type="button" aria-pressed={place.id === selected.id}
            aria-label={`Highlight ${place.name}`} title={place.name} onClick={() => onSelect(place.id)}
            style={{ left: `${x}%`, top: `${y}%` }}
            className="absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full hover:z-20 focus-visible:z-20 aria-pressed:z-10">
            <span className={`size-2.5 rounded-full border border-[#1b3128] ${place.id === selected.id ? "bg-[#f4ce83] ring-4 ring-[#f4ce83]/25" : "bg-[#a8c4b2]"}`} />
          </button>
        ))}
      </div>
      <p className="flex min-h-10 items-center justify-between gap-2 rounded-md border border-[#547263] bg-[#263e33] px-2.5 py-1.5 text-xs">
        <span className="min-w-0 break-words">{selected.name}</span>
        <span className="tnum shrink-0 font-semibold text-[#f4ce83]">~{formatMinutes(Math.max(1, selected.minutes))}</span>
      </p>
      <p className="mt-2 px-1 text-[11px] text-[#bbc9be]">Dots show direction and estimated time.</p>
    </figure>
  );
}
