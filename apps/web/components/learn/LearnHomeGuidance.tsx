"use client";

import Link from "next/link";
import { AudienceToggle } from "@/components/learn/AudienceToggle";
import { useLearnAudience, useLearnProgress } from "@/components/learn/useLearnProgress";
import { continueTarget } from "@/lib/lessons/progress";
import styles from "./LearnHome.module.css";

export function LearnHomeGuidance() {
  const { store, ready } = useLearnProgress();
  const { audience, setAudience } = useLearnAudience();
  const next = ready ? continueTarget(store) : null;

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>Learn</h1>
        <AudienceToggle audience={audience} onChange={setAudience} compact />
      </header>
      {next ? (
        <Link href={next.href} className={styles.continueCard} data-testid="learn-continue">
          <span className={styles.kicker}>{audience === "teacher" ? "Continue teaching" : "Continue learning"}</span>
          <span className={styles.continueTitle}>{next.title}</span>
          {next.reason ? <span className={styles.reason}>{next.reason}</span> : null}
        </Link>
      ) : null}
    </>
  );
}
