"use client";

import { useEffect, useState } from "react";
import styles from "./StudyPulseWidget.module.css";
import { Card, CardBody } from "@/components/ui/Card";

type Data = {
  averageScore: number;
  suggestion: string;
};

export function StudyPulseWidget() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/wellness/pulse")
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !data) return null;

  return (
    <Card className={styles.container}>
      <CardBody>
        <div className={styles.header}>
          <h3 className={styles.title}>Study Pulse</h3>
          <span className={styles.chip}>Learning Science</span>
        </div>
        <div className={styles.main}>
          <div className={styles.scoreRow}>
             <span className={styles.score}>{Math.round(data.averageScore)}%</span>
             <span className={styles.label}>Avg. Mastery</span>
          </div>
          <p className={styles.suggestion}>{data.suggestion}</p>
        </div>
      </CardBody>
    </Card>
  );
}
