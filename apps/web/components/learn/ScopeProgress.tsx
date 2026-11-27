"use client";

import { useLearnProgress } from "@/components/learn/useLearnProgress";
import { completionFor } from "@/lib/lessons/progress";
import styles from "./LessonStudio.module.css";

export function ScopeProgress({
  label,
  groups,
}: {
  label: string;
  groups: Array<{ key: string; label: string; lessonIds: string[] }>;
}) {
  const { store, ready } = useLearnProgress();
  const ids = groups.flatMap((group) => group.lessonIds);
  const overall = completionFor(store, ids);
  if (!ready || !ids.length) return null;

  return (
    <section className={styles.block} aria-label={label} data-testid="scope-progress">
      <div className={styles.titleRow}>
        <h2 className={styles.title} style={{ fontSize: "1.35rem" }}>
          {label}
        </h2>
        <strong>{overall.percent}%</strong>
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={overall.percent}
        aria-label={`${label} completion`}
      >
        <span className={styles.fill} style={{ width: `${overall.percent}%` }} />
      </div>
      <p className={styles.progressLabel}>
        {overall.completed} completed · {overall.inProgress} in progress · {overall.notStarted} not started
      </p>
      {groups.length > 1 ? (
        <div className={styles.checks}>
          {groups.map((group) => {
            const stat = completionFor(store, group.lessonIds);
            return (
              <div key={group.key}>
                <div className={styles.meta}>
                  <span>{group.label}</span>
                  <span>{stat.percent}%</span>
                </div>
                <div className={styles.track} aria-hidden="true">
                  <span className={styles.fill} style={{ width: `${stat.percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
