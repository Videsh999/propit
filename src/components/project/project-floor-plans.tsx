"use client";
import { useState } from "react";
import { LayoutGrid } from "lucide-react";
import { Img } from "@/components/ui/img";
import { formatArea } from "@/lib/format";
import type { ProjectProfile } from "@/types";

export function ProjectFloorPlans({ name, configurations, plans = [] }: { name: string; configurations: string[]; plans?: NonNullable<ProjectProfile["floorPlans"]> }) {
  const options = [...new Set([...configurations, ...plans.map(plan => plan.configuration)])];
  const [selected, setSelected] = useState(options[0] ?? "");
  const active = options.includes(selected) ? selected : options[0];
  const entries = plans.filter(plan => plan.configuration === active);
  return <div><div role="group" aria-label="Floor plan configurations" className="mb-5 flex gap-2 overflow-x-auto border-b border-line pb-3">{options.map(configuration => <button type="button" key={configuration} aria-pressed={active === configuration} onClick={() => setSelected(configuration)} className="min-h-11 shrink-0 rounded-full border border-line bg-paper px-5 text-sm font-semibold text-muted aria-pressed:bg-accent aria-pressed:text-accent-ink">{configuration}</button>)}</div>
    {entries.length ? <div className="grid gap-4 lg:grid-cols-2">{entries.map(plan => <figure key={plan.url} className="overflow-hidden rounded-2xl border border-line bg-paper"><figcaption className="border-b border-line p-4 text-sm font-semibold">{[plan.configuration, plan.unitSizeSqft && formatArea(plan.unitSizeSqft), plan.facing].filter(Boolean).join(" · ")}</figcaption>{/\.(png|jpe?g|webp|avif|svg)(?:[?#]|$)/i.test(plan.url) ? <Img src={plan.url} alt={`${name} ${plan.configuration} floor plan`} className="aspect-[4/3] w-full [&_img]:object-contain" sizes="700px" /> : <iframe title={`${name} ${plan.configuration} floor plan`} src={`${plan.url.split("#")[0]}#toolbar=0&navpanes=0`} referrerPolicy="no-referrer" className="h-96 w-full" />}</figure>)}</div> : <div role="status" className="rounded-2xl border border-dashed border-line bg-paper p-6"><LayoutGrid size={26} strokeWidth={1.5} className="text-accent" /><h3 className="mt-3 text-lg font-semibold">{active || "Project"} layout</h3><p className="mt-2 text-sm text-muted">The builder has not published a floor plan for this configuration. Explore the linked homes for area, facing and unit details.</p></div>}
  </div>;
}
