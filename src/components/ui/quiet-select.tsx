"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuietOption<T> {
  value: T;
  label: string;
}

/**
 * A filter that stays out of the way until it's needed.
 *
 * Reads as plain text when untouched and as a quiet pill once set, so a row of
 * these adds almost no visual weight — the point is that filters sit *under*
 * the primary journey, not compete with it.
 */
export function QuietSelect<T extends string | number | null>({
  label,
  value,
  options,
  onChange,
  multiple = false,
  values,
  onToggle,
  align = "left",
}: {
  label: string;
  value?: T;
  options: QuietOption<T>[];
  onChange?: (v: T) => void;
  multiple?: boolean;
  values?: T[];
  onToggle?: (v: T) => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = multiple
    ? (values?.length ?? 0) > 0
    : value !== null && value !== undefined && options.some((o) => o.value === value && o.value !== null);

  const display = multiple
    ? values && values.length
      ? values.length === 1
        ? options.find((o) => o.value === values[0])?.label ?? label
        : `${label} · ${values.length}`
      : label
    : options.find((o) => o.value === value)?.label ?? label;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition-colors duration-[160ms]",
          active
            ? "border-[var(--accent-line)] bg-[var(--accent-wash)] font-medium text-accent"
            : "border-line bg-raised text-muted hover:border-line-strong hover:text-ink",
        )}
      >
        {display}
        <ChevronDown size={13} strokeWidth={1.75} className={cn("transition-transform duration-[160ms]", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "absolute top-[calc(100%+6px)] z-50 min-w-[176px] overflow-hidden rounded-[var(--r-md)] border border-line bg-raised py-1 shadow-[var(--e3)]",
              align === "right" ? "right-0" : "left-0",
            )}
          >
            {options.map((o) => {
              const selected = multiple ? values?.includes(o.value) : value === o.value;
              return (
                <li key={String(o.value)}>
                  <button
                    role="option"
                    aria-selected={!!selected}
                    onClick={() => {
                      if (multiple) onToggle?.(o.value);
                      else {
                        onChange?.(o.value);
                        setOpen(false);
                      }
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-[13px] text-ink transition-colors hover:bg-sunk"
                  >
                    {o.label}
                    {selected && <Check size={13} strokeWidth={2} className="text-accent" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
