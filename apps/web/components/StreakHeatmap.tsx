"use client";

import { useEffect, useState } from "react";
import styles from "./StreakHeatmap.module.css";

type Activity = {
  quiz_date: string;
  questions_correct: number;
  questions_total: number;
};

export function StreakHeatmap() {
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/quiz/heatmap")
      .then(res => res.json())
      .then(data => {
        setActivity(data.activity ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.loading}>Loading streak...</div>;

  // Generate last 30 days
  const days = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayActivity = activity.find(a => a.quiz_date === dateStr);
    days.push({
      date: dateStr,
      active: !!dayActivity,
      score: dayActivity ? (dayActivity.questions_correct / dayActivity.questions_total) : 0,
    });
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Consistency Heatmap</h3>
      <div className={styles.grid}>
        {days.map((day) => (
          <div
            key={day.date}
            className={styles.day}
            data-active={day.active}
            style={{ opacity: day.active ? 0.4 + (day.score * 0.6) : 0.1 }}
            title={`${day.date}${day.active ? `: ${Math.round(day.score * 100)}% accuracy` : ': No activity'}`}
          />
        ))}
      </div>
      <div className={styles.footer}>
        <span>Last 30 days</span>
        <div className={styles.legend}>
          <span>Less</span>
          <div className={styles.day} style={{ opacity: 0.1 }} />
          <div className={styles.day} style={{ opacity: 0.5, background: 'var(--gold)' }} />
          <div className={styles.day} style={{ opacity: 1, background: 'var(--gold)' }} />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
