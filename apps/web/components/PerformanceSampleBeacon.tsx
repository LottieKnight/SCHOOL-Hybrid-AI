"use client";

import { useEffect } from "react";
import { API_BASE } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";

type PerformanceSampleBeaconProps = {
  routeTag: string;
};

function getTtiProxyMs() {
  if (typeof window === "undefined") return 0;
  const navigationEntry = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (navigationEntry && Number.isFinite(navigationEntry.domInteractive)) {
    return Math.max(1, Math.round(navigationEntry.domInteractive));
  }
  return Math.max(1, Math.round(performance.now()));
}

function getPayloadSizeBytes() {
  if (typeof window === "undefined") return null;
  const navigationEntry = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (!navigationEntry) return null;
  if (Number.isFinite(navigationEntry.transferSize) && navigationEntry.transferSize > 0) {
    return Math.round(navigationEntry.transferSize);
  }
  if (Number.isFinite(navigationEntry.encodedBodySize) && navigationEntry.encodedBodySize > 0) {
    return Math.round(navigationEntry.encodedBodySize);
  }
  return null;
}

export function PerformanceSampleBeacon({ routeTag }: PerformanceSampleBeaconProps) {
  const { session } = useSession();
  const apiBase = API_BASE;

  useEffect(() => {
    if (!session?.csrfToken) return;
    const ttiMs = getTtiProxyMs();
    const payloadBytes = getPayloadSizeBytes();
    const liteMode = document.documentElement.classList.contains("lite-mode");
    fetch(`${apiBase}/analytics/perf-sample`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": session.csrfToken,
      },
      body: JSON.stringify({
        route: routeTag,
        ttiMs,
        liteMode,
        payloadBytes,
      }),
    }).catch(() => {
      // Best-effort telemetry: do not interrupt UX.
    });
  }, [apiBase, routeTag, session?.csrfToken]);

  return null;
}
