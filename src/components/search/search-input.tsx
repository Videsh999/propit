"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Search, Sparkles, MapPin, Building2, Landmark, CornerDownLeft, Loader2 } from "lucide-react";
import { useSuggest, type Suggestion } from "@/lib/hooks/use-suggest";
import { useDiscovery } from "@/store/discovery";
import { cn } from "@/lib/utils";
import type { PropertyFilters } from "@/types";

const GROUP_ICON = {
  Localities: MapPin,
  Projects: Building2,
  Developers: Landmark,
  Nearby: MapPin,
  Properties: Building2,
} as const;

export function SearchInput({
  autoFocus,
  placeholder = "Search a locality, project, or just describe what you want…",
  size = "lg",
  onDone,
  className,
}: {
  autoFocus?: boolean;
  placeholder?: string;
  size?: "md" | "lg";
  onDone?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [running, setRunning] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isFetching } = useSuggest(value);
  const setFilters = useDiscovery((s) => s.setFilters);
  const setRadius = useDiscovery((s) => s.setRadius);
  const setUseBounds = useDiscovery((s) => s.setUseBounds);
  const flyTo = useDiscovery((s) => s.flyTo);
  const selectLocality = useDiscovery((s) => s.selectLocality);
  const setAssistantOpen = useDiscovery((s) => s.setAssistantOpen);

  const parsed = data?.parsed ?? null;

  // The assistant row is always last, so a question is never a dead end.
  const rows = useMemo(() => {
    const list: (Suggestion | { id: "__ask"; group: "Ask PropIT"; label: string; sublabel: string })[] =
      [...(data?.suggestions ?? [])];
    if (value.trim().length > 2) {
      list.push({
        id: "__ask",
        group: "Ask PropIT",
        label: value.trim(),
        sublabel: parsed?.isQuestion ? "Ask the assistant" : "Search with the assistant",
      });
    }
    return list;
  }, [data?.suggestions, value, parsed]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  async function runNaturalSearch(q: string) {
    setRunning(true);
    try {
      const res = await fetch("/api/search/natural", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, context: {} }),
      });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as {
        intent: string;
        parsed: {
          filters: Partial<PropertyFilters>;
          radiusKm: number | null;
          target: { name: string; location: { lat: number; lng: number } } | null;
        };
        needsAssistant: boolean;
      };

      setUseBounds(false);
      setFilters(json.parsed.filters);
      if (json.parsed.target && json.parsed.radiusKm) {
        setRadius({
          center: json.parsed.target.location,
          km: json.parsed.radiusKm,
          label: json.parsed.target.name,
        });
        flyTo(json.parsed.target.location, 12.4);
      } else if (json.parsed.target) {
        setRadius(null);
        flyTo(json.parsed.target.location, 13);
      }
      if (json.needsAssistant) setAssistantOpen(true);
      router.push("/search");
      onDone?.();
    } catch {
      // Falls through to the assistant, which can always take the question.
      setAssistantOpen(true);
    } finally {
      setRunning(false);
      setOpen(false);
    }
  }

  function pick(row: (typeof rows)[number]) {
    if (row.id === "__ask") {
      void runNaturalSearch(value.trim());
      return;
    }
    const s = row as Suggestion;
    setOpen(false);
    setValue("");
    if (s.group === "Localities" && s.slug) {
      setUseBounds(false);
      setFilters({ localitySlugs: [s.slug] });
      selectLocality(s.slug);
      if (s.location) flyTo(s.location, 13.2);
      router.push("/search");
    } else if (s.href) {
      router.push(s.href);
    } else if (s.location) {
      setUseBounds(false);
      setRadius({ center: s.location, km: 3, label: s.label });
      flyTo(s.location, 13);
      router.push("/search");
    }
    onDone?.();
  }

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex items-center gap-3 rounded-[var(--r-md)] border bg-raised transition-[border-color,box-shadow] duration-[160ms]",
          size === "lg" ? "h-14 px-4" : "h-11 px-3.5",
          open ? "border-[var(--accent-line)] shadow-[var(--e2)]" : "border-line shadow-[var(--e1)]",
        )}
      >
        {running || isFetching ? (
          <Loader2 size={17} className="animate-spin text-faint" strokeWidth={1.75} />
        ) : (
          <Search size={17} className="shrink-0 text-faint" strokeWidth={1.75} />
        )}
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setCursor(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, rows.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (rows[cursor]) pick(rows[cursor]);
              else if (value.trim()) void runNaturalSearch(value.trim());
            } else if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          placeholder={placeholder}
          aria-label="Search properties, projects and locations"
          role="combobox"
          aria-expanded={open}
          aria-controls="propit-suggestions"
          className={cn(
            "min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-faint",
            size === "lg" ? "text-[15px]" : "text-[14px]",
          )}
        />
        {value && (
          <kbd className="hidden shrink-0 items-center gap-1 rounded border border-line bg-sunk px-1.5 py-0.5 text-[10px] text-faint sm:flex">
            <CornerDownLeft size={10} /> Enter
          </kbd>
        )}
      </div>

      <AnimatePresence>
        {open && rows.length > 0 && (
          <motion.div
            id="propit-suggestions"
            role="listbox"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="scroll-quiet absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[420px] overflow-y-auto rounded-[var(--r-md)] border border-line bg-raised shadow-[var(--e3)]"
          >
            {parsed && parsed.confidence > 0.3 && (
              <div className="border-b border-line bg-sunk px-4 py-2 text-[12px] text-muted">
                Reading this as a search
                {parsed.radiusKm ? ` within ${parsed.radiusKm} km` : ""}
                {parsed.localityMentions.length ? ` in ${parsed.localityMentions.join(", ")}` : ""}
              </div>
            )}
            {rows.map((row, i) => {
              const prev = rows[i - 1];
              const showGroup = !prev || prev.group !== row.group;
              const isAsk = row.id === "__ask";
              const Icon = isAsk ? Sparkles : (GROUP_ICON[row.group as keyof typeof GROUP_ICON] ?? MapPin);
              return (
                <div key={row.id}>
                  {showGroup && (
                    <div className="eyebrow px-4 pb-1 pt-3">{row.group}</div>
                  )}
                  <button
                    role="option"
                    aria-selected={i === cursor}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => pick(row)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100",
                      i === cursor ? "bg-sunk" : "bg-transparent",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-[var(--r-sm)] border",
                        isAsk
                          ? "border-[var(--accent-line)] bg-[var(--accent-wash)] text-accent"
                          : "border-line bg-paper text-faint",
                      )}
                    >
                      <Icon size={13} strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] text-ink">{row.label}</span>
                      <span className="block truncate text-[12px] text-faint">{row.sublabel}</span>
                    </span>
                    {"count" in row && row.count ? (
                      <span className="tnum shrink-0 text-[12px] text-faint">{row.count} homes</span>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
