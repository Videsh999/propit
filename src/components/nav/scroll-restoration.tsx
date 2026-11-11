"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** The page scrolls in the body, so the browser's window history cannot restore it. */
export function ScrollRestoration() {
  const pathname = usePathname();
  const positions = useRef(new Map<string, number>());
  const historyTarget = useRef<string | null>(null);

  useLayoutEffect(() => {
    function recordHistoryTarget() {
      historyTarget.current = location.pathname;
    }
    window.addEventListener("popstate", recordHistoryTarget);
    return () => window.removeEventListener("popstate", recordHistoryTarget);
  }, []);

  useLayoutEffect(() => {
    const body = document.body;
    const restore = historyTarget.current === pathname;
    historyTarget.current = null;
    if (restore && !location.hash) body.scrollTop = positions.current.get(pathname) ?? 0;
    function remember() {
      positions.current.set(pathname, body.scrollTop);
    }
    body.addEventListener("scroll", remember, { passive: true });
    return () => body.removeEventListener("scroll", remember);
  }, [pathname]);

  return null;
}
