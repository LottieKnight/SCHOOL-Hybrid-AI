"use client";

import { useEffect, useState } from "react";
import { ExamReadinessScore } from "./ExamReadinessScore";
import styles from "./DailyBriefingCard.module.css";

type BriefingData = {
  weakTopics: Array<{ subject: string; topic_text: string; score: number }>;
  nextExam: { subject: string; date: string } | null;
  streak: number;
  readinessScore: number;
};

function isBriefingData(value: unknown): value is BriefingData {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<BriefingData>;
  return (
    Array.isArray(candidate.weakTopics) &&
    typeof candidate.streak === "number" &&
    typeof candidate.readinessScore === "number" &&
    (candidate.nextExam === null ||
      (typeof candidate.nextExam === "object" &&
        candidate.nextExam !== null &&
        typeof (candidate.nextExam as { subject: string; date: string }).subject === "string" &&
        typeof (candidate.nextExam as { subject: string; date: string }).date === "string"))
  );
}

export function DailyBriefingCard() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/intelligence/briefing")
      .then(res => (res.ok ? res.json() : Promise.resolve(null)))
      .then(d => {
        setData(isBriefingData(d) ? d : null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.loading}>Preparing your morning briefing...</div>;
  if (!data) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Morning Briefing</h3>
        <span className={styles.date}>{new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
      </div>

      <div className={styles.content}>
        <div className={styles.left}>
          <ExamReadinessScore score={data.readinessScore} />
          
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Current Streak</span>
              <span className={styles.statValue}>{data.streak} days 🔥</span>
            </div>
            {data.nextExam && (
              <div className={styles.stat}>
                <span className={styles.statLabel}>Next Exam</span>
                <span className={styles.statValue}>{data.nextExam.subject} ({new Date(data.nextExam.date).toLocaleDateString()})</span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.right}>
          <h4 className={styles.sectionTitle}>Focus Areas Today</h4>
          <div className={styles.topicList}>
            {data.weakTopics.length > 0 ? (
              data.weakTopics.map((topic, i) => (
                <div key={i} className={styles.topic}>
                  <span className={styles.topicSubject}>{topic.subject}</span>
                  <span className={styles.topicText}>{topic.topic_text}</span>
                </div>
              ))
            ) : (
              <p className={styles.empty}>You're all caught up! Keep practicing to stay sharp.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
