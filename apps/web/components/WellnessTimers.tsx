"use client";

import { useEffect, useState } from "react";
import styles from "./WellnessTimers.module.css";

export function WellnessTimers() {
  const [showEyeAlert, setShowEyeAlert] = useState(false);
  const [showWaterAlert, setShowHydrationAlert] = useState(false);

  useEffect(() => {
    // 20-20-20 Rule (Eye Strain): Every 20 mins
    const eyeTimer = setInterval(() => setShowEyeAlert(true), 20 * 60 * 1000);
    
    // Hydration: Every 45 mins
    const waterTimer = setInterval(() => setShowHydrationAlert(true), 45 * 60 * 1000);

    return () => {
      clearInterval(eyeTimer);
      clearInterval(waterTimer);
    };
  }, []);

  return (
    <div className={styles.container}>
      {showEyeAlert && (
        <div className={styles.alert}>
          <span className={styles.emoji}>👀</span>
          <div className={styles.content}>
            <strong>Eye Strain Alert</strong>
            <p>Look at something 20 feet away for 20 seconds.</p>
          </div>
          <button onClick={() => setShowEyeAlert(false)}>Got it</button>
        </div>
      )}
      {showWaterAlert && (
        <div className={styles.alert}>
          <span className={styles.emoji}>💧</span>
          <div className={styles.content}>
            <strong>Hydration Break</strong>
            <p>Time for a quick glass of water to keep your brain sharp.</p>
          </div>
          <button onClick={() => setShowHydrationAlert(false)}>Refilled</button>
        </div>
      )}
    </div>
  );
}
