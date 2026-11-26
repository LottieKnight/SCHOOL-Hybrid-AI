"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./TermProgressMap.module.css";

type WeekNode = {
  index: number; // 1-based
  name: string;
  topicTitle: string;
  href: string;
};

type WeekStatus = "done" | "active" | "default";

type TermProgressMapProps = {
  phase: string;
  grade: string;
  subject: string;
  termNumber: number;
  weeks: WeekNode[];
};

function normalizeGradeParam(grade: string): string {
  // Convert "grade-01" → "1", "grade-00" → "0", or pass through numerics
  const lower = grade.toLowerCase();
  if (lower.startsWith("grade-")) {
    const raw = lower.replace("grade-", "").replace(/^0+/, "") || "0";
    return raw;
  }
  return grade;
}

function useWeekStatuses(subject: string, grade: string, termNumber: number, weekCount: number) {
  const [statuses, setStatuses] = useState<Record<number, WeekStatus>>({});

  useEffect(() => {
    let cancelled = false;
    async function fetchMastery() {
      try {
        const params = new URLSearchParams({ subject, grade: normalizeGradeParam(grade) });
        const res = await fetch(`/api/analytics/mastery-heatmap?${params}`, { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const mastery: { topic_tag?: string; avg_score?: number; attempt_count?: number }[] =
          data.mastery ?? [];

        // Map topic tags like "term1-week3" or "t1w3" back to week numbers
        const map: Record<number, WeekStatus> = {};
        for (const item of mastery) {
          const tag = item.topic_tag ?? "";
          const match =
            tag.match(/term\s*(\d+)[\s\-_w]+week[\s\-_]*(\d+)/i) ??
            tag.match(/t(\d+)[\s\-_]?w(\d+)/i);
          if (!match) continue;
          const t = Number(match[1]);
          const w = Number(match[2]);
          if (t !== termNumber) continue;
          if (w < 1 || w > weekCount) continue;
          const score = item.avg_score ?? 0;
          const attempts = item.attempt_count ?? 0;
          if (attempts > 0) {
            map[w] = score >= 70 ? "done" : "active";
          }
        }

        if (!cancelled) setStatuses(map);
      } catch {
        // silent — default (outlined) state is fine
      }
    }
    fetchMastery();
    return () => { cancelled = true; };
  }, [subject, grade, termNumber, weekCount]);

  return statuses;
}

export function TermProgressMap({ phase, grade, subject, termNumber, weeks }: TermProgressMapProps) {
  const statuses = useWeekStatuses(subject, grade, termNumber, weeks.length);

  return (
    <div className={styles.wrap}>
      <div className={styles.legend}>
        <span className={styles.legendItem} data-status="done">Completed</span>
        <span className={styles.legendItem} data-status="active">In progress</span>
        <span className={styles.legendItem} data-status="default">Upcoming</span>
      </div>

      <div className={styles.track}>
        {weeks.map((week, i) => {
          const status: WeekStatus = statuses[week.index] ?? "default";
          const isLast = i === weeks.length - 1;
          return (
            <div key={week.index} className={styles.nodeWrap}>
              <Link
                href={week.href}
                className={styles.node}
                data-status={status}
                prefetch={false}
                title={week.topicTitle}
              >
                {status === "done" ? (
                  <svg className={styles.nodeIcon} viewBox="0 0 24 24" aria-hidden="true">
                    <polyline points="4 13 9 18 20 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span className={styles.nodeNumber}>{week.index}</span>
                )}
                {status === "active" && <span className={styles.pulse} aria-hidden="true" />}
              </Link>

              {!isLast && (
                <div
                  className={styles.connector}
                  data-filled={statuses[week.index] === "done" ? "true" : "false"}
                  aria-hidden="true"
                />
              )}

              <div className={styles.label}>
                <span className={styles.labelWeek}>Week {week.index}</span>
                <span className={styles.labelTopic} title={week.topicTitle}>
                  {week.topicTitle}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
