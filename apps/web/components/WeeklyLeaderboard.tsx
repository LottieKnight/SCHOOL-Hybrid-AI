"use client";

import { useEffect, useState } from "react";
import styles from "./WeeklyLeaderboard.module.css";

type LeaderboardEntry = {
  rank: number;
  displayName: string;
  xp: number;
};

export function WeeklyLeaderboard({ enabled = true }: { enabled?: boolean }) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setEntries([]);
      setLoading(false);
      return;
    }
    fetch("/api/leaderboard/weekly")
      .then((res) => (res.ok ? res.json() : Promise.resolve(null)))
      .then((data) => {
        const leaderboard = data && Array.isArray(data.leaderboard) ? data.leaderboard : null;
        setEntries(leaderboard ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [enabled]);

  if (!enabled) return null;
  if (loading) return <div className={styles.loading}>Loading rankings...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Weekly Leaderboard</h3>
        <span className={styles.subtitle}>Top Scholar XP</span>
      </div>
      <div className={styles.list}>
        {(entries ?? []).map((entry) => (
          <div key={entry.rank} className={styles.entry} data-rank={entry.rank}>
            <span className={styles.rank}>{entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}</span>
            <span className={styles.name}>{entry.displayName}</span>
            <span className={styles.xp}>{entry.xp.toLocaleString()} XP</span>
          </div>
        ))}
        {(entries ?? []).length === 0 && (
          <p className={styles.empty}>Leaderboard is temporarily unavailable. Check back soon.</p>
        )}
      </div>
    </div>
  );
}
