"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useDiscovery } from "@/store/discovery";
import { SearchInput } from "./search-input";

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen } = useDiscovery();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!useDiscovery.getState().paletteOpen);
      }
      if (e.key === "Escape" && useDiscovery.getState().paletteOpen) setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPaletteOpen]);

  return (
    <AnimatePresence>
      {paletteOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPaletteOpen(false)}
            className="fixed inset-0 z-[80] bg-[rgba(0,0,0,0.3)] backdrop-blur-[3px]"
          />
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.99 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-label="Search PropIT"
            className="fixed left-1/2 top-[14vh] z-[81] w-[min(640px,calc(100vw-32px))] -translate-x-1/2"
          >
            <SearchInput autoFocus onDone={() => setPaletteOpen(false)} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
