"use client";

import { useState } from "react";
import { ArrowUpRight, RotateCw } from "lucide-react";
import { Img } from "@/components/ui/img";
import styles from "./floor-plan.module.css";

const ROOMS = [
  { name: "Living", position: "1 / 1 / 3 / 3", tone: "#d7e4d7" },
  { name: "Kitchen", position: "3 / 1 / 4 / 3", tone: "#eadcc8" },
  { name: "Bedroom", position: "1 / 3 / 3 / 5", tone: "#dce4ee" },
  { name: "Bath", position: "3 / 3 / 4 / 4", tone: "#d9e7e8" },
  { name: "Entry", position: "3 / 4 / 4 / 5", tone: "#eee7d8" },
];

export function FloorPlan({ url, showDemo }: { url?: string | null; showDemo: boolean }) {
  const [view, setView] = useState<"2D" | "3D">("2D");
  const [turn, setTurn] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  if (url) {
    return (
      <figure className="mt-4 overflow-hidden rounded-xl border border-line">
        {!/\.pdf(?:[?#]|$)/i.test(url) && <Img src={url} alt="Floor plan supplied for this listing" className="aspect-[4/3] w-full [&_img]:object-contain" sizes="720px" />}
        <figcaption className="px-4 py-3 text-sm">
          <a href={url} className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">Open listing floor plan <ArrowUpRight size={14} /></a>
        </figcaption>
      </figure>
    );
  }

  if (!showDemo) return <p className="mt-4 text-sm text-muted">Floor plan not supplied for this listing.</p>;

  return (
    <figure className="mt-4 overflow-hidden rounded-xl border border-line">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <figcaption>
          <p className="text-sm font-semibold text-ink">Illustrative home layout</p>
          <p className="text-xs text-muted">Sample layout, not this property’s floor plan. Not to scale.</p>
        </figcaption>
        <div role="group" aria-label="Floor plan view" className="flex items-center gap-1 text-xs">
          {(["2D", "3D"] as const).map((mode) => (
            <button key={mode} type="button" aria-pressed={view === mode} onClick={() => setView(mode)}
              className={`rounded-full border px-3 py-2 ${view === mode ? "bg-inverse text-[var(--ink-inverse)]" : "text-muted"}`}>
              {mode}
            </button>
          ))}
          {view === "3D" && <button type="button" aria-label="Rotate floor plan" onClick={() => setTurn((value) => value + 90)}
            className="grid size-9 place-items-center rounded-full border border-line text-ink"><RotateCw size={15} /></button>}
        </div>
      </div>
      <div className={styles.stage} data-view={view}>
        <div className={styles.plan} style={{ "--turn": `${turn}deg` } as React.CSSProperties}>
          {ROOMS.map(({ name, position, tone }) => (
            <button key={name} type="button" aria-pressed={selected === name}
              onClick={() => setSelected(selected === name ? null : name)}
              className={styles.room} style={{ gridArea: position, backgroundColor: tone }}>
              <span>{name}</span>
            </button>
          ))}
        </div>
      </div>
      <p aria-live="polite" className="border-t border-line px-4 py-2 text-xs text-muted">{selected ? `Selected room · ${selected}` : "Select a room to highlight it."}</p>
    </figure>
  );
}
