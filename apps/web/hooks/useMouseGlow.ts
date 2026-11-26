"use client";

import { useCallback, useRef } from "react";

export function useMouseGlow(ref: React.RefObject<HTMLElement | null>) {
  const raf = useRef(0);

  const handleMove = useCallback(
    (e: React.MouseEvent) => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        el.style.setProperty("--mx", `${x}%`);
        el.style.setProperty("--my", `${y}%`);
      });
    },
    [ref],
  );

  return { onMouseMove: handleMove };
}
