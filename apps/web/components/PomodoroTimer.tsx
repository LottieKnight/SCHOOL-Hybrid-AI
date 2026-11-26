"use client";

import { useEffect, useState } from "react";
import styles from "./PomodoroTimer.module.css";

export function PomodoroTimer() {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      const audio = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
      audio.play().catch(() => {});
      
      if (!isBreak) {
        // Reward XP for completing a Pomodoro
        fetch("/api/xp", {
          method: "POST",
          body: JSON.stringify({ amount: 25, actionType: "POMODORO_COMPLETE", metadata: { duration: 25 } }),
        }).catch(() => {});
      }
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, isBreak]);

  const toggle = () => setIsActive(!isActive);
  const reset = () => {
    setIsActive(false);
    setIsBreak(false);
    setTimeLeft(25 * 60);
  };
  const startBreak = () => {
    setIsActive(false);
    setIsBreak(true);
    setTimeLeft(5 * 60);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className={styles.container} data-break={isBreak}>
      <div className={styles.header}>
        <span className={styles.label}>{isBreak ? "Break Time" : "Study Session"}</span>
        <span className={styles.timer}>{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}</span>
      </div>
      <div className={styles.controls}>
        <button type="button" className={styles.btn} onClick={toggle}>{isActive ? "Pause" : "Start"}</button>
        <button type="button" className={styles.btn} onClick={reset}>Reset</button>
        {!isBreak && <button type="button" className={styles.btn} onClick={startBreak}>Break</button>}
      </div>
    </div>
  );
}
