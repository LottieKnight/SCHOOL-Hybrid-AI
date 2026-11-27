"use client";

import type { LearnAudience } from "@/lib/lessons/progressStorage";
import styles from "./LessonStudio.module.css";

export function AudienceToggle({
  audience,
  onChange,
  compact = false,
}: {
  audience: LearnAudience;
  onChange: (audience: LearnAudience) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={compact ? `${styles.toggle} ${styles.toggleCompact}` : styles.toggle}
      role="group"
      aria-label="Lesson audience"
      data-testid="learn-audience-toggle"
    >
      <button
        type="button"
        className={styles.toggleButton}
        data-active={audience === "student" ? "true" : "false"}
        aria-pressed={audience === "student"}
        data-testid="learn-audience-student"
        onClick={() => onChange("student")}
      >
        Student
      </button>
      <button
        type="button"
        className={styles.toggleButton}
        data-active={audience === "teacher" ? "true" : "false"}
        aria-pressed={audience === "teacher"}
        data-testid="learn-audience-teacher"
        onClick={() => onChange("teacher")}
      >
        Teacher
      </button>
    </div>
  );
}
