"use client";
import { useState } from "react";

export function RangeFilter({ label, value, max, step, limit = 1e13, format, onChange }: { label: string; value: [number | null, number | null]; max: number; step: number; limit?: number; format: (value: number) => string; onChange: (value: [number | null, number | null]) => void }) {
  const [draft, setDraft] = useState<[number | null, number | null] | null>(null);
  const shown = draft ?? value;
  const ceiling = Math.max(max, shown[0] ?? 0, shown[1] ?? 0);
  function change(index: number, next: number | null, commit = false) {
    if (next !== null) {
      if (!Number.isFinite(next)) return;
      next = Math.min(limit, Math.max(0, next));
      if (step === 1) next = Math.round(next);
    }
    const pair: [number | null, number | null] = [...shown]; pair[index] = next;
    if (next != null && pair[1 - index] != null && (index === 0 ? next > pair[1]! : next < pair[0]!)) pair[1 - index] = next;
    if (commit) { onChange(pair); setDraft(null); } else setDraft(pair);
  }
  function finish() { if (draft) { onChange(draft); setDraft(null); } }
  return <div>
    <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{label}</h3><button type="button" onClick={() => { setDraft(null); onChange([null, null]); }} className="min-h-8 text-xs text-accent">Any</button></div>
    <p className="mb-3 text-sm font-semibold text-accent" aria-live="polite">{shown[0] == null ? "Any" : format(shown[0])} – {shown[1] == null ? "Any" : format(shown[1])}</p>
    {[0, 1].map(index => <label key={index} className="mb-3 block"><span className="mb-1 flex justify-between text-xs text-muted"><span>{index === 0 ? "Minimum" : "Maximum"}</span><span>{format(shown[index] ?? (index ? ceiling : 0))}</span></span><input type="range" min={0} max={ceiling} step={step} value={shown[index] ?? (index ? ceiling : 0)} aria-label={`${index ? "Maximum" : "Minimum"} ${label.toLowerCase()}`} aria-valuetext={format(shown[index] ?? (index ? ceiling : 0))} onChange={event => change(index, Number(event.target.value))} onPointerUp={finish} onKeyUp={finish} onBlur={finish} className="propit-range w-full" /></label>)}
    <div className="grid grid-cols-2 gap-3">{[0, 1].map(index => <label key={index} className="text-xs text-muted">{index ? "Maximum" : "Minimum"}<input type="number" min={0} step={step} value={value[index] ?? ""} placeholder="Any" aria-label={`${index ? "Maximum" : "Minimum"} ${label.toLowerCase()} value`} onChange={event => change(index, event.target.value === "" ? null : Math.max(0, Number(event.target.value)), true)} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-raised px-3 text-sm text-ink" /></label>)}</div>
  </div>;
}
