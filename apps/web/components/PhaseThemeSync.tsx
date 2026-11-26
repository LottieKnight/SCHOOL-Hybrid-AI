"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const PHASE_KEYS = new Set(["foundation", "intermediate", "senior", "fet"]);

export function PhaseThemeSync() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const match = pathname?.match(/^\/(?:phase|learn)\/([^/]+)/);
    const phase = match?.[1];

    if (phase && PHASE_KEYS.has(phase)) {
      root.dataset.phase = phase;
    } else {
      delete root.dataset.phase;
    }

    if (pathname === "/") {
      root.dataset.page = "home";
    } else {
      delete root.dataset.page;
    }
  }, [pathname]);

  return null;
}
