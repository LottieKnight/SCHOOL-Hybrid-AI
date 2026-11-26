"use client";

import { useEffect, useState } from "react";
import { daysUntilExam } from "../utils/examCountdown";
export { daysUntilExam };
import styles from "./ExamCountdownWidget.module.css";
import { Card, CardBody } from "@/components/ui/Card";

type Exam = {
  subject: string;
  date: string;
};

export function ExamCountdownWidget({ exams: propExams, enabled = true }: { exams?: Exam[]; enabled?: boolean }) {
  const [exams, setExams] = useState<Exam[]>(propExams || []);
  const [loading, setLoading] = useState(enabled && !propExams);

  useEffect(() => {
    if (!enabled) {
      setExams([]);
      setLoading(false);
      return;
    }
    if (propExams) {
      setExams(propExams);
      setLoading(false);
      return;
    }
    // Fallback if no props
    fetch("/api/intelligence/briefing")
      .then(res => res.json())
      .then(data => {
        if (data.nextExam) setExams([data.nextExam]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [enabled, propExams]);

  if (loading || exams.length === 0) return null;

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Exam Countdown</h3>
      <div className={styles.grid}>
        {exams.map((exam, i) => {
          const days = daysUntilExam(exam.date);
          return (
            <div key={i} className={styles.exam} data-urgent={days <= 14}>
              <div className={styles.daysCol}>
                <span className={styles.days}>{days}</span>
                <span className={styles.daysLabel}>days</span>
              </div>
              <div className={styles.meta}>
                <span className={styles.subject}>{exam.subject}</span>
                <span className={styles.date}>{new Date(exam.date).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
