"use client";

import styles from "./PasswordStrengthMeter.module.css";
import { getPasswordStrength } from "@/utils/passwordStrength";

interface Props {
  password: string;
}

export function PasswordStrengthMeter({ password }: Props) {
  const { score, label, color } = getPasswordStrength(password);

  if (score === -1) return null;

  return (
    <div className={styles.container}>
      <div className={styles.segments}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={styles.segment}
            style={{ backgroundColor: i <= score ? color : "var(--border, #333)" }}
          />
        ))}
      </div>
      <span className={styles.label} style={{ color }}>
        {label}
      </span>
    </div>
  );
}
