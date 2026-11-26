"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./ContinueLearningCard.module.css";

type AdaptivePathItem = {
  subject?: string;
  grade?: number;
  phase?: string;
  term?: number;
  week?: number;
  topicTitle?: string;
  reason?: string;
  href?: string;
};

export function ContinueLearningCard({ phase, grade }: { phase: string; grade: string }) {
  const [item, setItem] = useState<AdaptivePathItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchPath() {
      try {
        const res = await fetch("/api/analytics/adaptive-path?limit=1", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const first: AdaptivePathItem | undefined = data.path?.[0];
        if (!first || cancelled) return;
        // Only show if relevant to the current phase/grade context
        const href = first.href ?? (
          first.phase && first.grade !== undefined && first.subject && first.term && first.week
            ? `/learn/${first.phase}/grade-${String(first.grade).padStart(2, "0")}/${first.subject}/term/${first.term}/week/${first.week}`
            : null
        );
        if (href) setItem({ ...first, href });
      } catch {
        // silent — card simply doesn't render
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPath();
    return () => { cancelled = true; };
  }, [phase, grade]);

  if (loading || !item) return null;

  return (
    <Link href={item.href!} className={styles.card} prefetch={false}>
      <div className={styles.eyebrow}>Continue where you left off</div>
      <div className={styles.title}>
        {item.subject ? item.subject.replace(/-/g, " ") : "Your next lesson"}
        {item.term && item.week ? ` · Term ${item.term}, Week ${item.week}` : ""}
      </div>
      {item.topicTitle && <div className={styles.topic}>{item.topicTitle}</div>}
      {item.reason && <div className={styles.reason}>{item.reason}</div>}
      <div className={styles.cta}>
        Resume <span aria-hidden="true">→</span>
      </div>
    </Link>
  );
}
