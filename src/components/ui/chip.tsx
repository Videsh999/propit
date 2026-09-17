"use client";

import { cn } from "@/lib/utils";

export function Chip({
  active,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium",
        "transition-[background-color,border-color,color] duration-[160ms] [transition-timing-function:var(--ease)]",
        active
          ? "border-[var(--accent)] bg-accent text-[var(--accent-ink)]"
          : "border-line bg-raised text-muted hover:border-line-strong hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
