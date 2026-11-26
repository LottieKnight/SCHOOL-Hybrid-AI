import Link from "next/link";
import type { Metadata } from "next";
import { renderMarkdown } from "@/lib/markdown";
import { legalMarkdown } from "@/lib/legalContent";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy — SCHOOL",
  description: "How SCHOOL collects, uses, and protects your personal information. POPIA and GDPR compliant.",
};

export default function PrivacyPage() {
  const raw = legalMarkdown.privacy;
  const html = renderMarkdown(raw);

  return (
    <div className={styles.page}>
      <Link className={styles.back} href="/">← Back home</Link>
      <article
        className={styles.body}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <nav className={styles.nav}>
        <Link className={styles.navLink} href="/legal/terms">Terms of Service</Link>
        <Link className={styles.navLink} href="/legal/cookies">Cookie Policy</Link>
        <Link className={styles.navLink} href="/legal/aup">Acceptable Use</Link>
      </nav>
    </div>
  );
}
