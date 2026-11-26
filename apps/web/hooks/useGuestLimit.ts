"use client";

import { useCallback, useEffect, useState } from "react";

const DEFAULT_STORAGE_KEY = "school_guest_ai_generations";

type UseGuestLimitOptions = {
  limit?: number;
  storageKey?: string;
};

export function useGuestLimit(options: UseGuestLimitOptions = {}) {
  const limit = options.limit ?? 1;
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
  const [count, setCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const value = Number(window.localStorage.getItem(storageKey) ?? "0");
    setCount(Number.isFinite(value) && value > 0 ? value : 0);
    setHydrated(true);
  }, [storageKey]);

  const increment = useCallback(() => {
    setCount((current) => {
      const next = current + 1;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, String(next));
      }
      return next;
    });
  }, [storageKey]);

  const reset = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }
    setCount(0);
  }, [storageKey]);

  return {
    count,
    hydrated,
    limit,
    hasReachedLimit: count >= limit,
    remaining: Math.max(0, limit - count),
    increment,
    reset,
  };
}
