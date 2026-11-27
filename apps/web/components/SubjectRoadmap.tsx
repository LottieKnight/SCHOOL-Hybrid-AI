"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLearnProgress } from "@/components/learn/useLearnProgress";
import { parseGradeSlug } from "@/lib/lessons/catalogue";
import { lessonStatus } from "@/lib/lessons/progress";
import { buildLessonId } from "@/lib/lessons/schema";
import styles from "./SubjectRoadmap.module.css";

type WeekInfo = {
  index: number;
  topicTitle: string;
  href: string;
};

type TermPanel = {
  termNumber: number;
  termName: string;
  weekCount: number;
  weeks: WeekInfo[];
  href: string;
};

type SubjectRoadmapProps = {
  phase: string;
  grade: string;
  subject: string;
  subjectName: string;
  gradeNumber: number;
  terms: TermPanel[];
};

type TermStatus = Record<number, { done: number; inProgress: number }>;

function useTermStatuses(subject: string, gradeNumber: number): TermStatus {
  const [statuses, setStatuses] = useState<TermStatus>({});
  useEffect(() => {
    let cancelled = false;
    async function fetch_() {
      try {
        const params = new URLSearchParams({ subject, grade: String(gradeNumber) });
        const res = await fetch(`/api/analytics/mastery-heatmap?${params}`, { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const mastery: { topic_tag?: string; avg_score?: number; attempt_count?: number }[] =
          data.mastery ?? [];
        const map: TermStatus = {};
        for (const item of mastery) {
          const tag = item.topic_tag ?? "";
          const match =
            tag.match(/term\s*(\d+)[\s\-_w]+week[\s\-_]*(\d+)/i) ??
            tag.match(/t(\d+)[\s\-_]?w(\d+)/i);
          if (!match) continue;
          const t = Number(match[1]);
          const attempts = item.attempt_count ?? 0;
          if (attempts === 0) continue;
          const score = item.avg_score ?? 0;
          if (!map[t]) map[t] = { done: 0, inProgress: 0 };
          if (score >= 70) map[t].done += 1;
          else map[t].inProgress += 1;
        }
        if (!cancelled) setStatuses(map);
      } catch {
        // silent fallback
      }
    }
    fetch_();
    return () => { cancelled = true; };
  }, [subject, gradeNumber]);
  return statuses;
}

export function SubjectRoadmap({
  phase,
  grade,
  subject,
  subjectName,
  gradeNumber,
  terms,
}: SubjectRoadmapProps) {
  const termStatuses = useTermStatuses(subject, gradeNumber);
  const { store } = useLearnProgress();
  const parsedGrade = parseGradeSlug(grade) ?? gradeNumber;

  return (
    <div className={styles.wrap}>
      <div className={styles.actions}>
        <Link
          href={`/learn/${phase}/${grade}/${subject}/practice`}
          className={styles.actionBtn}
          data-variant="practice"
          prefetch={false}
        >
          <span className={styles.actionIcon} aria-hidden="true">⚡</span>
          Adaptive Practice
        </Link>
        <Link
          href={`/learn/${phase}/${grade}/${subject}/exam`}
          className={styles.actionBtn}
          data-variant="exam"
          prefetch={false}
        >
          <span className={styles.actionIcon} aria-hidden="true">📝</span>
          Exam Simulation
        </Link>
        <Link
          href={`/learn/${phase}/${grade}/${subject}/flashcards`}
          className={styles.actionBtn}
          data-variant="flashcards"
          prefetch={false}
        >
          <span className={styles.actionIcon} aria-hidden="true">🗂</span>
          Flashcards
        </Link>
      </div>

      <div className={styles.grid}>
        {terms.map((term) => {
          const status = termStatuses[term.termNumber];
          const localDone = term.weeks.filter(
            (week) =>
              lessonStatus(
                store,
                buildLessonId({
                  phase,
                  grade: parsedGrade,
                  subjectKey: subject,
                  term: term.termNumber,
                  week: week.index,
                })
              ) === "completed"
          ).length;
          const localActive = term.weeks.filter(
            (week) =>
              lessonStatus(
                store,
                buildLessonId({
                  phase,
                  grade: parsedGrade,
                  subjectKey: subject,
                  term: term.termNumber,
                  week: week.index,
                })
              ) === "in_progress"
          ).length;
          const done = localDone || (status?.done ?? 0);
          const inProg = localActive || (status?.inProgress ?? 0);
          const pct = term.weekCount > 0 ? Math.round((done / term.weekCount) * 100) : 0;

          return (
            <div key={term.termNumber} className={styles.termCard}>
              <div className={styles.termHeader}>
                <div>
                  <div className={styles.termLabel}>Term {term.termNumber}</div>
                  <div className={styles.termName}>{term.termName}</div>
                </div>
                {done > 0 && (
                  <div className={styles.termPct}>{pct}%</div>
                )}
              </div>

              <div className={styles.dots}>
                {term.weeks.map((week) => {
                  const localStatus = lessonStatus(
                    store,
                    buildLessonId({
                      phase,
                      grade: parsedGrade,
                      subjectKey: subject,
                      term: term.termNumber,
                      week: week.index,
                    })
                  );
                  const dotStatus =
                    localStatus === "completed" ? "done" :
                    localStatus === "in_progress" ? "active" :
                    week.index <= done ? "done" :
                    week.index <= done + inProg ? "active" :
                    "default";
                  return (
                    <Link
                      key={week.index}
                      href={week.href}
                      className={styles.dot}
                      data-status={dotStatus}
                      title={`Week ${week.index}: ${week.topicTitle}`}
                      prefetch={false}
                    />
                  );
                })}
              </div>

              {/* First 3 topic titles as preview */}
              <div className={styles.topicPreview}>
                {term.weeks.slice(0, 3).map((week) => (
                  <div key={week.index} className={styles.topicRow}>
                    <span className={styles.topicWeekNum}>{week.index}</span>
                    <span className={styles.topicTitle}>{week.topicTitle}</span>
                  </div>
                ))}
                {term.weeks.length > 3 && (
                  <div className={styles.topicMore}>+{term.weeks.length - 3} more weeks</div>
                )}
              </div>

              <Link href={term.href} className={styles.enterBtn} prefetch={false}>
                Enter Term {term.termNumber} <span aria-hidden="true">→</span>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
