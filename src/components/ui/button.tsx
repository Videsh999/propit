"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "quiet" | "inverse";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "border border-accent bg-accent bg-[image:linear-gradient(145deg,#ffffff16,transparent)] text-[var(--accent-ink)] hover:bg-accent-hover active:translate-y-px shadow-e1",
  secondary:
    "bg-raised text-ink border border-line shadow-e1 hover:border-line-strong hover:bg-sunk active:translate-y-px",
  ghost: "text-ink hover:bg-sunk active:translate-y-px",
  quiet: "text-muted hover:text-ink hover:bg-sunk",
  inverse: "bg-inverse text-[var(--ink-inverse)] hover:opacity-90 active:translate-y-px",
};

// Shared control dimensions keep actions consistent across cards and panels.
const SIZES: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[13px] gap-1.5 rounded-[var(--r-pill)]",
  md: "h-10 px-5 text-[14px] gap-2 rounded-[var(--r-pill)]",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-[var(--r-pill)]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium",
        "transition-[background-color,border-color,color,transform,opacity] duration-[190ms] [transition-timing-function:var(--ease)] motion-reduce:transition-none",
        "disabled:pointer-events-none disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});
