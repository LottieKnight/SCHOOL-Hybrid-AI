"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type PastPapersPrefetchLinksProps = {
  hrefs: string[];
  max?: number;
  delayMs?: number;
};

export function PastPapersPrefetchLinks({
  hrefs,
  max = 16,
  delayMs = 180,
}: PastPapersPrefetchLinksProps) {
  const router = useRouter();

  useEffect(() => {
    const uniqueHrefs = Array.from(new Set(hrefs.filter(Boolean))).slice(0, max);
    if (!uniqueHrefs.length) return;

    let cancelled = false;
    let index = 0;

    const run = () => {
      if (cancelled) return;
      if (index >= uniqueHrefs.length) return;
      router.prefetch(uniqueHrefs[index]);
      index += 1;
      window.setTimeout(run, 70);
    };

    const timer = window.setTimeout(run, delayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [delayMs, hrefs, max, router]);

  return null;
}
