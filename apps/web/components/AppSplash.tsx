"use client";

import { useEffect, useState } from "react";
import { useSplashStore } from "@/store/splashStore";
import { useSession } from "@/components/SessionProvider";
import { getStoredLiteMode } from "@/lib/liteMode";
import { shouldPlaySplashSound, shouldSkipSplash } from "@/lib/splashPolicy";
import styles from "./AppSplash.module.css";

const WORDMARK = "SCHOOL".split("");

const ROLE_TAGLINES: Record<string, string> = {
  student: "Your next chapter starts here.",
  teacher: "Guiding the next generation.",
  admin: "Command center ready.",
};

function readSplashContext() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  let alreadySeenThisSession = false;
  try {
    alreadySeenThisSession = sessionStorage.getItem("school:splash:session") === "1";
  } catch {
    alreadySeenThisSession = false;
  }
  return {
    reducedMotion,
    saveData: Boolean(connection?.saveData),
    effectiveType: String(connection?.effectiveType || ""),
    liteMode: getStoredLiteMode() === true,
    alreadySeenThisSession,
  };
}

function playCompletionChord() {
  try {
    if (localStorage.getItem("school:sound") !== "on") return;
    if (!shouldPlaySplashSound("on")) return;
    const ctx = new AudioContext();
    const notes = [220, 277, 330];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.06;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.04, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.8);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.9);
    });
  } catch {
    /* audio unavailable */
  }
}

export function AppSplash() {
  const { session } = useSession();
  const { isFirstVisit, dismissed, dismiss, hydrate } = useSplashStore();
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);

  const userRole = session?.user?.role;
  const tagline = ROLE_TAGLINES[userRole ?? "student"] ?? ROLE_TAGLINES.student;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (dismissed) {
      setVisible(false);
      return;
    }

    const context = readSplashContext();
    setReduced(context.reducedMotion || context.liteMode);
    if (shouldSkipSplash(context)) {
      dismiss();
      setVisible(false);
      return;
    }

    const duration = isFirstVisit ? 1600 : 350;
    const timer = window.setTimeout(() => {
      if (shouldPlaySplashSound(localStorage.getItem("school:sound"))) playCompletionChord();
      dismiss();
      window.setTimeout(() => setVisible(false), context.reducedMotion ? 0 : 280);
    }, duration);

    return () => window.clearTimeout(timer);
  }, [dismissed, isFirstVisit, dismiss]);

  if (!visible || dismissed) return null;

  return (
    <div className={styles.splash} data-reduced={reduced ? "true" : undefined} role="dialog" aria-label="SCHOOL">
      <span className={`${styles.orb} ${styles.orb1}`} aria-hidden="true" />
      <span className={`${styles.orb} ${styles.orb2}`} aria-hidden="true" />
      <div className={styles.wordmark} aria-hidden="true">
        {WORDMARK.map((letter, index) => (
          <span key={letter + index} className={styles.letter} style={{ animationDelay: `${0.05 * index}s` }}>
            {letter}
          </span>
        ))}
      </div>
      <div className={styles.accentLine} aria-hidden="true" />
      <p className={styles.tagline}>{tagline}</p>
      <div className={styles.throbber} aria-hidden="true">
        <span className={styles.throbDot} />
        <span className={styles.throbDot} />
        <span className={styles.throbDot} />
      </div>
      <button type="button" className={styles.skip} onClick={() => { dismiss(); setVisible(false); }}>
        Skip
      </button>
    </div>
  );
}
