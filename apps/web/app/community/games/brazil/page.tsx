import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "BRAZIL — A Student Survival Story",
  description: "Navigate student life chaos in this text-based narrative adventure. Every choice matters.",
};

export default function BrazilGamePage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/community/games" className={styles.backLink}>
            ← Games Center
          </Link>
          <span className={styles.genre}>Narrative · Text Adventure</span>
        </div>
        <span className={styles.badge}>🇧🇷 BRAZIL</span>
      </div>

      <div className={styles.frameWrap}>
        <iframe
          src="/games/brazil.html"
          title="BRAZIL — A Student Survival Story"
          className={styles.frame}
          allowFullScreen
          sandbox="allow-scripts allow-same-origin"
        />
      </div>

      <p className={styles.hint}>
        Best played on desktop. Use your keyboard or on-screen buttons to navigate the story.
      </p>
    </div>
  );
}
