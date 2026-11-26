"use client";

import { useEffect, useState } from "react";

type Exam = {
  subject: string;
  date: string;
};

export function ExamCountdown({ exams }: { exams: Exam[] }) {
  const [nearest, setNearest] = useState<Exam | null>(null);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!exams.length) return;

    const now = new Date();
    const sorted = [...exams]
      .map((e) => ({ ...e, d: new Date(e.date) }))
      .filter((e) => e.d > now)
      .sort((a, b) => a.d.getTime() - b.d.getTime());

    if (sorted.length > 0) {
      const next = sorted[0];
      setNearest(next);
      const diff = next.d.getTime() - now.getTime();
      setDaysLeft(Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }
  }, [exams]);

  if (!nearest || daysLeft === null) return null;

  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: "8px",
        background: "var(--amber-dim)",
        border: "1px solid var(--amber-border)",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        fontSize: "13px",
      }}
    >
      <span style={{ fontSize: "16px" }}>⏳</span>
      <div>
        <strong style={{ color: "var(--amber)" }}>{daysLeft} days</strong> until {nearest.subject} exam
      </div>
    </div>
  );
}
