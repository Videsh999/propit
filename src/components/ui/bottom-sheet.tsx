"use client";

import { useCallback, useRef, useState } from "react";
import { motion, useMotionValue, animate, type PanInfo } from "motion/react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/hooks/use-media-query";

/** Fractions of the viewport the sheet is allowed to rest at. */
const DETENTS = [0.12, 0.55, 0.92] as const;
export type Detent = 0 | 1 | 2;

/**
 * Draggable bottom sheet with three resting positions. Dragging is real — the
 * sheet follows the finger and settles on the nearest detent, biased by throw
 * velocity so a flick moves a full step.
 */
export function BottomSheet({
  children,
  header,
  detent,
  onDetentChange,
  className,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  detent: Detent;
  onDetentChange: (d: Detent) => void;
  className?: string;
}) {
  const [vh, setVh] = useState(() => (typeof window === "undefined" ? 800 : window.innerHeight));
  const y = useMotionValue(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();

  const topFor = useCallback((d: Detent) => vh * (1 - DETENTS[d]), [vh]);

  // Keep the sheet anchored when the viewport resizes (rotation, keyboard).
  const measure = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const h = window.innerHeight;
      if (h !== vh) setVh(h);
      y.set(h * (1 - DETENTS[detent]));
    },
    [detent, vh, y],
  );

  const settle = useCallback(
    (_: unknown, info: PanInfo) => {
      const current = y.get();
      // A decisive flick advances a detent regardless of distance travelled.
      const projected = current + info.velocity.y * 0.18;
      let nearest: Detent = 0;
      let best = Infinity;
      for (let i = 0; i < DETENTS.length; i++) {
        const d = Math.abs(topFor(i as Detent) - projected);
        if (d < best) {
          best = d;
          nearest = i as Detent;
        }
      }
      onDetentChange(nearest);
      animate(y, topFor(nearest), reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 40 });
    },
    [y, topFor, onDetentChange, reduce],
  );

  return (
    <motion.div
      ref={measure}
      style={{ y, height: vh }}
      drag="y"
      dragConstraints={{ top: topFor(2), bottom: topFor(0) }}
      dragElastic={0.04}
      dragMomentum={false}
      onDragEnd={settle}
      animate={{ y: topFor(detent) }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 40 }}
      className={cn(
        "fixed inset-x-0 top-0 z-40 flex flex-col rounded-t-[var(--r-canvas)] border-t border-line bg-paper shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.18)]",
        className,
      )}
      role="dialog"
      aria-label="Results"
    >
      {/* Grab handle — the whole header area is draggable */}
      <div className="shrink-0 cursor-grab touch-none active:cursor-grabbing">
        <div className="flex justify-center pb-1 pt-2.5">
          <span className="h-1 w-9 rounded-full bg-[var(--line-strong)]" />
        </div>
        {header}
      </div>

      <div
        ref={scrollRef}
        className={cn(
          "scroll-quiet min-h-0 flex-1",
          detent === 0 ? "overflow-hidden" : "overflow-y-auto",
        )}
        // Let the sheet drag rather than the list scroll when collapsed.
        style={{ touchAction: detent === 0 ? "none" : "pan-y" }}
      >
        {children}
      </div>
    </motion.div>
  );
}
