"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Briefcase, GraduationCap, Home, MapPin, Plus, Search, X, Loader2 } from "lucide-react";
import { useDiscovery } from "@/store/discovery";
import { useSuggest } from "@/lib/hooks/use-suggest";
import type { Anchor, AnchorKind } from "@/types";
import { cn } from "@/lib/utils";

const KIND_META: Record<
  AnchorKind,
  { icon: typeof Briefcase; label: string; short: string; prompt: string; km: number }
> = {
  office: { icon: Briefcase, label: "My office", short: "Office", prompt: "Where do you work?", km: 6 },
  school: { icon: GraduationCap, label: "My child's school", short: "School", prompt: "Where does your child study?", km: 4 },
  family: { icon: Home, label: "My family", short: "Family", prompt: "Who do you need to stay close to?", km: 10 },
  gym: { icon: MapPin, label: "My gym", short: "Gym", prompt: "Where do you train?", km: 3 },
  other: { icon: MapPin, label: "Somewhere else", short: "Place", prompt: "What else matters?", km: 5 },
};

const OFFERED: AnchorKind[] = ["office", "school", "family"];
const RADII = [1, 2, 3, 5, 10];

/**
 * The product's opening move: name the places your life happens, and the map
 * answers. Everything here resolves in place — picking a location flies the map
 * and drops a pin without a navigation, because leaving the page would break
 * the sense that the map is responding to you.
 */
export function LifePlaces() {
  const { anchors, addAnchor, removeAnchor, updateAnchor, flyTo, fitBounds } = useDiscovery();
  const [openKind, setOpenKind] = useState<AnchorKind | null>(null);
  // "Somewhere else" is offered only once asked for — three prompts is an
  // invitation, four is a form.
  const [otherShown, setOtherShown] = useState(false);

  const anchorFor = (kind: AnchorKind) => anchors.find((a) => a.kind === kind);
  const kinds: AnchorKind[] = otherShown || anchorFor("other") ? [...OFFERED, "other"] : OFFERED;

  return (
    <div className="space-y-1.5">
      {kinds.map((kind) => {
        const meta = KIND_META[kind];
        const anchor = anchorFor(kind);
        const isOpen = openKind === kind;

        if (anchor && !isOpen) {
          return (
            <SetPlace
              key={kind}
              anchor={anchor}
              icon={meta.icon}
              onChange={() => setOpenKind(kind)}
              onRemove={() => removeAnchor(anchor.id)}
              onFocusMap={() => flyTo(anchor.location, 12.6)}
              onRadius={(km) => updateAnchor(anchor.id, { maxKm: km })}
            />
          );
        }

        return (
          <div key={kind}>
            {!isOpen ? (
              <button
                onClick={() => setOpenKind(kind)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-[var(--r-md)] border border-line bg-raised px-3.5 py-2.5 text-left",
                  "transition-[border-color,background-color] duration-[180ms] [transition-timing-function:var(--ease)]",
                  "hover:border-[var(--data-brass)]",
                )}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sunk text-muted transition-colors duration-[180ms] group-hover:bg-[var(--data-brass)] group-hover:text-white">
                  <meta.icon size={14} strokeWidth={1.75} />
                </span>
                <span className="flex-1 text-[14px] text-ink">{meta.label}</span>
                <Plus size={15} strokeWidth={2} className="shrink-0 text-faint transition-colors group-hover:text-ink" />
              </button>
            ) : (
              <PlaceSearch
                kind={kind}
                existing={anchor}
                onClose={() => setOpenKind(null)}
                onPick={(name, location) => {
                  if (anchor) {
                    updateAnchor(anchor.id, { location, address: name });
                  } else {
                    addAnchor({
                      // "My child's school" is how we ask; "School" is how the
                      // map, the status bar and the assistant refer to it.
                      label: meta.short,
                      kind,
                      location,
                      address: name,
                      maxKm: meta.km,
                      weight: 1,
                    });
                  }
                  setOpenKind(null);
                  // Let the map show the answer rather than jumping the user away.
                  flyTo(location, 12.6);
                }}
              />
            )}
          </div>
        );
      })}

      {!otherShown && !anchorFor("other") && (
        <button
          onClick={() => {
            setOtherShown(true);
            setOpenKind("other");
          }}
          className="flex w-full items-center gap-3 rounded-[var(--r-md)] border border-dashed border-line px-3.5 py-2.5 text-left text-[14px] text-muted transition-colors duration-[180ms] hover:border-line-strong hover:text-ink"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-faint">
            <Plus size={15} strokeWidth={2} />
          </span>
          Add another place
        </button>
      )}

      {anchors.length > 1 && (
        <button
          onClick={() => {
            const lats = anchors.map((a) => a.location.lat);
            const lngs = anchors.map((a) => a.location.lng);
            fitBounds({
              west: Math.min(...lngs) - 0.06,
              south: Math.min(...lats) - 0.06,
              east: Math.max(...lngs) + 0.06,
              north: Math.max(...lats) + 0.06,
            });
          }}
          className="w-full pt-1 text-left text-[12px] text-muted underline decoration-[var(--line-strong)] underline-offset-4 transition-colors hover:text-ink"
        >
          Show all {anchors.length} places on the map
        </button>
      )}
    </div>
  );
}

function SetPlace({
  anchor, icon: Icon, onChange, onRemove, onFocusMap, onRadius,
}: {
  anchor: Anchor;
  icon: typeof Briefcase;
  onChange: () => void;
  onRemove: () => void;
  onFocusMap: () => void;
  onRadius: (km: number) => void;
}) {
  const [radiusOpen, setRadiusOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[var(--r-md)] border border-[var(--accent-line)] bg-[var(--accent-wash)] px-3.5 py-2.5"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--data-brass)] text-white">
          <Icon size={14} strokeWidth={1.75} />
        </span>
        <button onClick={onFocusMap} className="min-w-0 flex-1 text-left">
          <span className="block text-[12px] leading-tight text-muted">{anchor.label}</span>
          <span className="block truncate text-[14px] font-medium leading-tight text-ink">
            {anchor.address || "Dropped pin"}
          </span>
        </button>
        <button
          onClick={onChange}
          className="shrink-0 text-[12px] text-accent underline-offset-4 hover:underline"
        >
          Change
        </button>
        <button
          onClick={onRemove}
          aria-label={`Remove ${anchor.label}`}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-[var(--r-sm)] text-faint transition-colors hover:bg-sunk hover:text-ink"
        >
          <X size={13} strokeWidth={2} />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-1.5 pl-10">
        <span className="text-[12px] text-muted">Within</span>
        <div className="relative">
          <button
            onClick={() => setRadiusOpen((v) => !v)}
            className="tnum rounded-full border border-[var(--accent-line)] bg-raised px-2.5 py-0.5 text-[12px] font-medium text-accent"
          >
            {anchor.maxKm} km
          </button>
          <AnimatePresence>
            {radiusOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-[calc(100%+4px)] z-30 flex gap-0.5 rounded-full border border-line bg-raised p-1 shadow-[var(--e2)]"
              >
                {RADII.map((km) => (
                  <button
                    key={km}
                    onClick={() => {
                      onRadius(km);
                      setRadiusOpen(false);
                    }}
                    className={cn(
                      "tnum rounded-full px-2.5 py-1 text-[12px] transition-colors",
                      anchor.maxKm === km
                        ? "bg-accent text-[var(--accent-ink)]"
                        : "text-muted hover:bg-sunk hover:text-ink",
                    )}
                  >
                    {km}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function PlaceSearch({
  kind, existing, onPick, onClose,
}: {
  kind: AnchorKind;
  existing?: Anchor;
  onPick: (name: string, location: { lat: number; lng: number }) => void;
  onClose: () => void;
}) {
  const meta = KIND_META[kind];
  const [q, setQ] = useState(existing?.address ?? "");
  const [cursor, setCursor] = useState(0);
  const { data, isFetching } = useSuggest(q);
  const ref = useRef<HTMLDivElement>(null);

  const results = (data?.suggestions ?? []).filter((s) => s.location).slice(0, 6);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-[var(--r-md)] border border-[var(--accent-line)] bg-raised shadow-[var(--e2)]"
    >
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--data-brass)] text-white">
          <meta.icon size={14} strokeWidth={1.75} />
        </span>
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === "Enter" && results[cursor]) {
              e.preventDefault();
              onPick(results[cursor].label, results[cursor].location!);
            } else if (e.key === "Escape") {
              onClose();
            }
          }}
          placeholder={meta.prompt}
          aria-label={meta.prompt}
          className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
        />
        {isFetching ? (
          <Loader2 size={14} className="shrink-0 animate-spin text-faint" />
        ) : (
          <Search size={14} className="shrink-0 text-faint" strokeWidth={1.75} />
        )}
        <button
          onClick={onClose}
          aria-label="Cancel"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-[var(--r-sm)] text-faint hover:bg-sunk hover:text-ink"
        >
          <X size={13} strokeWidth={2} />
        </button>
      </div>

      {q.trim().length > 0 && (
        <ul className="max-h-56 overflow-y-auto border-t border-line scroll-quiet">
          {results.length === 0 && !isFetching && (
            <li className="px-3.5 py-2.5 text-[13px] text-faint">
              Nothing found. Try a locality, office park or landmark.
            </li>
          )}
          {results.map((s, i) => (
            <li key={s.id}>
              <button
                onMouseEnter={() => setCursor(i)}
                onClick={() => onPick(s.label, s.location!)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors",
                  i === cursor ? "bg-sunk" : "bg-transparent",
                )}
              >
                <MapPin size={13} strokeWidth={1.75} className="shrink-0 text-faint" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">{s.label}</span>
                  <span className="block truncate text-[11px] text-faint">{s.sublabel}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
