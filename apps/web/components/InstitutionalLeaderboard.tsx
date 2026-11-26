"use client";

import { useEffect, useState } from "react";
import styles from "./WeeklyLeaderboard.module.css"; // Reuse styles for consistency

type Entry = {
  rank: number;
  name: string;
  xp: number;
  students: number;
};

export function InstitutionalLeaderboard() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard/institutions")
      .then((res) => (res.ok ? res.json() : Promise.resolve(null)))
      .then((data) => {
        setEntries(data && Array.isArray(data.leaderboard) ? data.leaderboard : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Institutional Pride</h3>
        <span className={styles.subtitle}>Top Universities</span>
      </div>
      <div className={styles.list}>
        {entries.length === 0 && (
          <p className={styles.empty}>Institutional leaderboard is temporarily unavailable.</p>
        )}
        {entries.map((entry) => (
          <div key={entry.rank} className={styles.entry} data-rank={entry.rank}>
            <span className={styles.rank}>{entry.rank === 1 ? "🏆" : `#${entry.rank}`}</span>
            <div className={styles.nameCol}>
              <span className={styles.name}>{entry.name}</span>
              <span className={styles.studentCount}>{entry.students} scholars contributing</span>
            </div>
            <span className={styles.xp}>{entry.xp.toLocaleString()} XP</span>
          </div>
        ))}
      </div>
    </div>
  );
}
