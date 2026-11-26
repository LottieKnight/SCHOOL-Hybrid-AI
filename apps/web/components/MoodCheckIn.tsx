"use client";

import { useState } from "react";
import styles from "./MoodCheckIn.module.css";

type Mood = "focused" | "tired" | "stressed";

export function MoodCheckIn() {
  const [selected, setSelected] = useState<Mood | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleMood = (mood: Mood) => {
    setSelected(mood);
    setSubmitted(true);
    // Persist to local state or API (Sprint 2 - Personalisation)
    localStorage.setItem("saedu_daily_mood", JSON.stringify({ value: mood, updatedAt: new Date().toISOString() }));
  };

  if (submitted) return (
    <div className={styles.submitted}>
      Got it. We've adjusted your study sessions for today! ⚡
    </div>
  );

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>How are you feeling today?</h3>
      <div className={styles.options}>
        <button type="button" className={styles.option} onClick={() => handleMood("focused")}>
          <span className={styles.emoji}>🎯</span>
          <span>Focused</span>
        </button>
        <button type="button" className={styles.option} onClick={() => handleMood("tired")}>
          <span className={styles.emoji}>😴</span>
          <span>Tired</span>
        </button>
        <button type="button" className={styles.option} onClick={() => handleMood("stressed")}>
          <span className={styles.emoji}>🤯</span>
          <span>Stressed</span>
        </button>
      </div>
    </div>
  );
}
