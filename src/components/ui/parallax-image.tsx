"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Img } from "@/components/ui/img";
import { cn } from "@/lib/utils";

/**
 * An image that settles as it passes through the viewport.
 *
 * The frame is fixed; the photograph inside it moves a little slower than the
 * page and eases from a slight zoom to rest. It reads as depth rather than as an
 * effect. The travel is bounded by the overscan, so no edge is ever exposed.
 */
export function ParallaxImage({
  src,
  alt,
  seed,
  className,
  sizes,
  strength = 0.08,
}: {
  src: string;
  alt: string;
  seed?: string;
  className?: string;
  sizes?: string;
  /** Fraction of the frame height the image may travel. */
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  const y = useTransform(scrollYProgress, [0, 1], [`${-strength * 100}%`, `${strength * 100}%`]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.14, 1.06, 1.1]);

  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      <motion.div
        className="absolute inset-0"
        // Overscan exceeds the travel, so the frame never shows an empty edge.
        style={reduce ? undefined : { y, scale, top: `${-strength * 100}%`, bottom: `${-strength * 100}%` }}
      >
        <Img src={src} alt={alt} seed={seed} className="h-full w-full" sizes={sizes} />
      </motion.div>
    </div>
  );
}
