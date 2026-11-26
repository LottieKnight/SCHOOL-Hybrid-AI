"use client";

import { useEffect, useState } from "react";
import styles from "./BadgeWall.module.css";

type Badge = {
  key: string;
  title: string;
  description: string;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  earned_at: string | null;
};

export function BadgeWall() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/badges")
      .then((res) => res.json())
      .then((data) => {
        setBadges(data.badges ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.loading}>Loading achievements...</div>;

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Achievements</h3>
      <div className={styles.grid}>
        {badges.map((badge) => (
          <div
            key={badge.key}
            className={styles.badge}
            data-earned={!!badge.earned_at}
            data-tier={badge.tier}
            title={`${badge.title}: ${badge.description}`}
          >
            <div className={styles.icon}>{badge.icon}</div>
            <div className={styles.badgeTitle}>{badge.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
