"use client";

import styles from "./ExamReadinessScore.module.css";

type Props = {
  score: number;
};

export function ExamReadinessScore({ score }: Props) {
  const rating = score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Fair" : "Struggling";
  const color = score >= 70 ? "var(--green)" : score >= 50 ? "var(--amber)" : "var(--red)";

  return (
    <div className={styles.container}>
      <div className={styles.circle} style={{ "--score": score, "--color": color } as any}>
        <div className={styles.inner}>
          <span className={styles.score}>{score}%</span>
        </div>
      </div>
      <div className={styles.meta}>
        <strong className={styles.rating} style={{ color }}>{rating}</strong>
        <p className={styles.label}>Exam Readiness</p>
      </div>
    </div>
  );
}
