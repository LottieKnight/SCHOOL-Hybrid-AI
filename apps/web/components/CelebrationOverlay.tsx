"use client";

import { useEffect, useState } from "react";
import styles from "./CelebrationOverlay.module.css";

type CelebrationType = "level_up" | "badge_earned" | "streak_milestone";

export function CelebrationOverlay() {
  const [active, setActive] = useState(false);
  const [type, setType] = useState<CelebrationType>("level_up");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handleCelebrate = (e: CustomEvent<{ type: CelebrationType; message: string }>) => {
      setType(e.detail.type);
      setMessage(e.detail.message);
      setActive(true);
      setTimeout(() => setActive(false), 5000);
    };

    window.addEventListener("saedu:celebrate" as any, handleCelebrate);
    return () => window.removeEventListener("saedu:celebrate" as any, handleCelebrate);
  }, []);

  if (!active) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.content} data-type={type}>
        <div className={styles.particles}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className={styles.particle} style={{ "--idx": i } as any} />
          ))}
        </div>
        <div className={styles.card}>
          <div className={styles.glow} />
          <h2 className={styles.title}>
            {type === "level_up" ? "Level Up!" : type === "badge_earned" ? "New Achievement!" : "Streak Milestone!"}
          </h2>
          <p className={styles.message}>{message}</p>
          <div className={styles.shine} />
        </div>
      </div>
    </div>
  );
}

export function triggerCelebration(type: CelebrationType, message: string) {
  const event = new CustomEvent("saedu:celebrate", { detail: { type, message } });
  window.dispatchEvent(event);
}
