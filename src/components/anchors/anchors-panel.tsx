"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Briefcase, GraduationCap, Home, Dumbbell, MapPin, X, Plus, Info, Loader2 } from "lucide-react";
import { useDiscovery } from "@/store/discovery";
import { useZone } from "@/lib/hooks/use-properties";
import { useApplyRelaxation } from "@/lib/hooks/use-relaxation";
import { Button } from "@/components/ui/button";
import { formatCount, formatPriceSqft } from "@/lib/format";
import { useSuggest } from "@/lib/hooks/use-suggest";
import type { AnchorKind } from "@/types";
import { cn } from "@/lib/utils";

const KINDS: { kind: AnchorKind; label: string; icon: typeof Briefcase; km: number }[] = [
  { kind: "office", label: "Office", icon: Briefcase, km: 6 },
  { kind: "school", label: "School", icon: GraduationCap, km: 4 },
  { kind: "family", label: "Family", icon: Home, km: 10 },
  { kind: "gym", label: "Gym", icon: Dumbbell, km: 3 },
  { kind: "other", label: "Other", icon: MapPin, km: 5 },
];

const ICONS = { office: Briefcase, school: GraduationCap, family: Home, gym: Dumbbell, other: MapPin };

export function AnchorsPanel() {
  const {
    anchors,
    anchorsOpen,
    setAnchorsOpen,
    addAnchor,
    updateAnchor,
    removeAnchor,
    prioritiseAnchor,
    setFilters,
    fitBounds,
    flyTo,
  } = useDiscovery();
  const { data: zone, isFetching } = useZone();
  const applyRelaxation = useApplyRelaxation();
  const [adding, setAdding] = useState<AnchorKind | null>(null);
  const [explain, setExplain] = useState<string | null>(null);

  if (!anchorsOpen) return null;

  const prioritised = anchors.find((a) => a.weight >= 2)?.id ?? null;

  return (
    <motion.aside
      initial={{ x: -24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -24, opacity: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="scroll-quiet absolute left-3 top-3 z-30 flex max-h-[calc(100%-24px)] w-[min(360px,calc(100%_-_24px))] flex-col overflow-y-auto rounded-[var(--r-lg)] border border-line bg-raised shadow-[var(--e3)]"
      aria-label="Your anchors"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-raised px-4 py-3">
        <div>
          <h2 className="text-[15px] font-medium text-ink">Your anchors</h2>
          <p className="text-[12px] text-faint">The places your life already happens</p>
        </div>
        <button
          onClick={() => setAnchorsOpen(false)}
          className="grid h-7 w-7 place-items-center rounded-[var(--r-sm)] text-faint transition-colors hover:bg-sunk hover:text-ink"
          aria-label="Close anchors"
        >
          <X size={15} strokeWidth={1.75} />
        </button>
      </header>

      <div className="divide-y divide-[var(--line)]">
        {anchors.map((a) => {
          const Icon = ICONS[a.kind];
          return (
            <div key={a.id} className="px-4 py-3.5">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--data-brass)] text-white">
                  <Icon size={13} strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <input
                    value={a.label}
                    onChange={(e) => updateAnchor(a.id, { label: e.target.value })}
                    className="w-full bg-transparent text-[14px] font-medium text-ink outline-none"
                    aria-label="Anchor label"
                  />
                  <button
                    onClick={() => flyTo(a.location, 14)}
                    className="truncate text-left text-[12px] text-faint underline-offset-2 hover:text-muted hover:underline"
                  >
                    {a.address || "Drag the pin to adjust"}
                  </button>
                </div>
                <button
                  onClick={() => removeAnchor(a.id)}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-[var(--r-sm)] text-faint transition-colors hover:bg-sunk hover:text-ink"
                  aria-label={`Remove ${a.label}`}
                >
                  <X size={13} strokeWidth={1.75} />
                </button>
              </div>

              <div className="mt-3 pl-9.5">
                <div className="mb-1 flex items-baseline justify-between">
                  <label htmlFor={`km-${a.id}`} className="text-[11px] text-faint">
                    Within
                  </label>
                  <span className="tnum text-[12px] font-medium text-ink">{a.maxKm} km</span>
                </div>
                <input
                  id={`km-${a.id}`}
                  type="range"
                  min={0.5}
                  max={25}
                  step={0.5}
                  value={a.maxKm}
                  onChange={(e) => updateAnchor(a.id, { maxKm: Number(e.target.value) })}
                  className="h-1 w-full cursor-pointer appearance-none rounded-full bg-[var(--line)] accent-[var(--accent)]"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Add */}
      <div className="border-t border-line px-4 py-3">
        {adding ? (
          <AnchorSearch
            kind={adding}
            onCancel={() => setAdding(null)}
            onPick={(label, location, address) => {
              const km = KINDS.find((k) => k.kind === adding)?.km ?? 5;
              addAnchor({ label, kind: adding, location, address, maxKm: km, weight: 1 });
              setAdding(null);
              flyTo(location, 12.5);
            }}
          />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k.kind}
                onClick={() => setAdding(k.kind)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 text-[12px] text-muted transition-colors hover:border-[var(--data-brass)] hover:text-ink"
              >
                <Plus size={12} strokeWidth={2} />
                {k.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Livable zone */}
      {anchors.length > 0 && (
        <div className="border-t border-line bg-sunk px-4 py-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[13px] font-medium text-ink">Livable zone</h3>
            <span className="tnum text-[13px] font-semibold text-ink">
              {isFetching && !zone ? (
                <Loader2 size={13} className="animate-spin text-faint" />
              ) : (
                `${formatCount(zone?.total ?? 0)} ${zone?.total === 1 ? "home" : "homes"}`
              )}
            </span>
          </div>
          {zone?.areaKm2 ? (
            <p className="tnum mt-0.5 text-[11px] text-faint">
              about {zone.areaKm2} km² satisfies every anchor
            </p>
          ) : null}

          {zone && zone.localityBreakdown.length > 0 && (
            <>
              <div className="eyebrow mt-4">Best fit</div>
              <ul className="mt-1.5 space-y-1.5">
                {zone.localityBreakdown.slice(0, 4).map((b) => (
                  <li key={b.slug}>
                    <button
                      onClick={() => setFilters({ localitySlugs: [b.slug] })}
                      className="flex w-full items-baseline justify-between gap-2 text-left text-[13px] transition-colors hover:text-accent"
                    >
                      <span className="truncate text-ink">{b.name}</span>
                      <span className="tnum shrink-0 text-[12px] text-faint">
                        {b.count} · {formatPriceSqft(b.avgPriceSqft)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {zone.bounds && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => fitBounds(zone.bounds!)}
                >
                  Zoom to the zone
                </Button>
              )}
            </>
          )}

          {/* Zero results is never a dead end */}
          {zone && zone.total === 0 && zone.relaxations.length > 0 && (
            <div className="mt-3 rounded-[var(--r-md)] border border-line bg-raised p-3">
              <p className="text-[13px] leading-relaxed text-ink">{zone.relaxations[0].message}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {zone.relaxations.slice(0, 3).map((r) => (
                  <Button
                    key={r.label}
                    size="sm"
                    variant={r === zone.relaxations[0] ? "primary" : "secondary"}
                    onClick={() => applyRelaxation(r)}
                  >
                    {r.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {anchors.length > 1 && (
            <>
              <div className="eyebrow mt-4">Prioritise</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button
                  onClick={() => prioritiseAnchor(null)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[12px] transition-colors",
                    prioritised === null
                      ? "border-[var(--accent-line)] bg-[var(--accent-wash)] text-accent"
                      : "border-line bg-raised text-muted hover:text-ink",
                  )}
                >
                  Balanced
                </button>
                {anchors.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => prioritiseAnchor(a.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[12px] transition-colors",
                      prioritised === a.id
                        ? "border-[var(--accent-line)] bg-[var(--accent-wash)] text-accent"
                        : "border-line bg-raised text-muted hover:text-ink",
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {zone?.routingIsEstimate && (
            <button
              onClick={() => setExplain(explain ? null : "routing")}
              className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-faint hover:text-muted"
            >
              <Info size={11} strokeWidth={1.75} />
              Distances are straight-line
            </button>
          )}
          <AnimatePresence>
            {explain === "routing" && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 overflow-hidden text-[11px] leading-relaxed text-faint"
              >
                PropIT measures straight-line distance until a routing provider is connected. Real
                driving times will differ — usually by 30–40% on Hyderabad&apos;s road network.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.aside>
  );
}

function AnchorSearch({
  kind,
  onPick,
  onCancel,
}: {
  kind: AnchorKind;
  onPick: (label: string, location: { lat: number; lng: number }, address: string) => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState("");
  const { data, isFetching } = useSuggest(q);
  const withLocation = (data?.suggestions ?? []).filter((s) => s.location);
  const defaultLabel = KINDS.find((k) => k.kind === kind)?.label ?? "Place";

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
            if (e.key === "Enter" && withLocation[0]) {
              onPick(defaultLabel, withLocation[0].location!, withLocation[0].label);
            }
          }}
          placeholder={`Where is your ${defaultLabel.toLowerCase()}?`}
          className="h-9 flex-1 rounded-[var(--r-sm)] border border-line bg-paper px-3 text-[13px] text-ink outline-none placeholder:text-faint focus:border-[var(--accent-line)]"
        />
        <button
          onClick={onCancel}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--r-sm)] text-faint hover:bg-sunk hover:text-ink"
          aria-label="Cancel"
        >
          <X size={14} />
        </button>
      </div>
      {q.length > 0 && (
        <ul className="mt-2 max-h-56 overflow-y-auto rounded-[var(--r-sm)] border border-line">
          {isFetching && withLocation.length === 0 && (
            <li className="px-3 py-2 text-[12px] text-faint">Looking…</li>
          )}
          {!isFetching && withLocation.length === 0 && (
            <li className="px-3 py-2 text-[12px] text-faint">
              Nothing found. Try a locality, landmark or office park.
            </li>
          )}
          {withLocation.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => onPick(defaultLabel, s.location!, s.label)}
                className="block w-full px-3 py-2 text-left transition-colors hover:bg-sunk"
              >
                <span className="block truncate text-[13px] text-ink">{s.label}</span>
                <span className="block truncate text-[11px] text-faint">{s.sublabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
