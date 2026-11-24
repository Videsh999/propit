"use client";

import { useId, useState } from "react";
import { ChartNoAxesCombined, House, KeyRound } from "lucide-react";
import { projectPricePoints, type ProjectListing } from "@/lib/data/project-presentation";
import { formatPriceSqft, formatRent } from "@/lib/format";
import type { Locality } from "@/types";

type Mode = "locality" | "buy" | "rent";
const MODES = [{ id: "locality", label: "Locality trend", icon: ChartNoAxesCombined }, { id: "buy", label: "Sale asking prices", icon: House }, { id: "rent", label: "Rental asking prices", icon: KeyRound }] as const;

export function ProjectInsights({ locality, listings }: { locality: Pick<Locality, "name" | "priceHistory" | "dataQuality"> | null; listings: ProjectListing[] }) {
  const [mode, setMode] = useState<Mode>(locality?.priceHistory.length ? "locality" : "buy");
  const [selection, setSelection] = useState<string | null>(null);
  const fillId = useId();
  const points = mode === "locality" ? [...(locality?.priceHistory ?? [])].filter(point => Number.isFinite(point.priceSqft) && point.priceSqft > 0).sort((a, b) => a.year - b.year).map(point => ({ label: String(point.year), value: point.priceSqft, count: null, min: point.priceSqft, max: point.priceSqft })) : projectPricePoints(listings, mode);
  const selected = points.find(point => point.label === selection) ?? points.at(-1);
  const max = Math.max(1, ...points.map(point => point.value)) * 1.15;
  const coordinates = points.map((point, index) => ({ ...point, x: points.length === 1 ? 420 : 70 + index / (points.length - 1) * 690, y: 210 - point.value / max * 180 }));
  const line = coordinates.map((point, i) => `${i ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const currency = (value: number) => mode === "rent" ? formatRent(Math.round(value)) : formatPriceSqft(Math.round(value));
  const description = mode === "locality" ? `${locality?.name ?? "Locality"} annual average price per sq.ft` : mode === "buy" ? "Median asking price per sq.ft by configuration" : "Median monthly asking rent by configuration";

  return <div>
    <div role="group" aria-label="Price insight views" className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-paper p-1.5 sm:w-fit">
      {MODES.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={mode === id} onClick={() => { setMode(id); setSelection(null); }} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-[14px] font-semibold text-muted transition-colors aria-pressed:bg-accent aria-pressed:text-accent-ink sm:px-4"><Icon size={15} />{label}</button>)}
    </div>
    <div className="mt-5 rounded-2xl border border-line bg-paper p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-[14px] text-muted">{description}</p><p className="mt-2 text-xs text-muted">{mode === "locality" ? locality?.dataQuality === "estimated" ? "Modelled locality estimates" : "Locality catalog data" : "Current linked listings · asking prices"}</p></div>
        {selected && <div className="text-right" aria-live="polite"><p className="text-xs font-semibold text-muted">{selected.label}{selected.count != null && ` · ${selected.count} ${selected.count === 1 ? "listing" : "listings"}`}</p><p className="mt-1 text-xl font-semibold tracking-tight text-accent">{currency(selected.value)}</p></div>}
      </div>
      {points.length ? <>
        <div className="relative mt-4 h-56 sm:h-72" role="group" aria-label={description}>
          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 800 250" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".23" /><stop offset="100%" stopColor="var(--accent)" stopOpacity=".02" /></linearGradient></defs>
            {[0, .5, 1].map(fraction => <path key={fraction} d={`M 70 ${210 - fraction * 180} H 760`} stroke="var(--line)" strokeDasharray={fraction ? "4 5" : undefined} />)}
            {coordinates.length > 1 && <path d={`${line} L ${coordinates.at(-1)!.x} 210 L ${coordinates[0].x} 210 Z`} fill={`url(#${fillId})`} />}
            <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          </svg>
          {[0, .5, 1].map(fraction => <span key={fraction} aria-hidden="true" className="absolute -translate-y-1/2 whitespace-nowrap text-right text-xs leading-none text-muted" style={{ left: 0, width: "7.25%", top: `${(210 - fraction * 180) / 2.5}%` }}>{fraction ? `${(max * fraction / 1000).toLocaleString("en-IN", { maximumFractionDigits: 1 })}k` : "0"}</span>)}
          {coordinates.map((point, index) => <button key={point.label} type="button" aria-pressed={selected?.label === point.label} aria-label={`${point.label}: ${currency(point.value)}`} onFocus={() => setSelection(point.label)} onPointerEnter={() => setSelection(point.label)} onClick={() => setSelection(point.label)} onKeyDown={event => {
            if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
            event.preventDefault(); const next = Math.max(0, Math.min(coordinates.length - 1, index + (event.key === "ArrowRight" ? 1 : -1))); setSelection(coordinates[next].label);
            const sibling = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button[data-chart-point]')[next]; sibling?.focus();
          }} data-chart-point className="absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full outline-offset-2" style={{ left: `${point.x / 8}%`, top: `${point.y / 2.5}%` }}><span aria-hidden="true" className={`rounded-full border-2 border-accent bg-raised ${selected?.label === point.label ? "size-3 ring-4 ring-accent/10" : "size-2"}`} /></button>)}
          <div aria-hidden="true">{coordinates.filter((_, index) => index === 0 || index === coordinates.length - 1 || index === Math.floor(coordinates.length / 2)).map((point, index, labels) => <span key={point.label} className={`absolute bottom-0 max-w-[28%] text-xs leading-tight text-muted ${labels.length === 1 || (index > 0 && index < labels.length - 1) ? "-translate-x-1/2 text-center" : index === labels.length - 1 ? "-translate-x-full text-right" : "text-left"}`} style={{ left: `${point.x / 8}%` }}>{point.label}</span>)}</div>
        </div>
        <details className="mt-3 border-t border-line pt-3"><summary className="min-h-8 cursor-pointer text-[14px] font-semibold text-accent">View chart data</summary><div className="mt-2 overflow-x-auto"><table className="w-full text-left text-[14px]"><caption className="sr-only">{description}</caption><thead><tr className="border-b border-line"><th scope="col" className="py-2">{mode === "locality" ? "Year" : "Configuration"}</th><th scope="col">{mode === "rent" ? "Median rent / month" : "Price / sq.ft"}</th>{mode !== "locality" && <th scope="col">Listings</th>}</tr></thead><tbody>{points.map(point => <tr key={point.label} className="border-b border-line"><th scope="row" className="py-2 font-medium">{point.label}</th><td>{currency(point.value)}</td>{mode !== "locality" && <td>{point.count}</td>}</tr>)}</tbody></table></div></details>
      </> : <p role="status" className="py-10 text-center text-[14px] text-muted">{mode === "rent" ? "No rental prices are available for this project." : mode === "locality" ? "No locality price history has been supplied." : "No sale prices are available for this project."}</p>}
    </div>
    <p className="mt-3 text-xs leading-relaxed text-muted">{mode === "locality" ? "Locality averages provide area context; they are not this project’s registered transaction prices." : "Based on the linked listings shown on this page. Asking prices are not completed sale prices or a valuation."}</p>
  </div>;
}
