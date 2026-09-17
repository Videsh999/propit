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
        // 40px on a phone, 32px from `sm` up. A 32px chip is fine under a
        // cursor and cramped under a thumb; Apple's own floor is 44px and the
        // gap between rows here makes 40 comfortable without re-flowing any
        // layout that was built around the desktop height.
        "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium sm:h-8 sm:px-3",
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
