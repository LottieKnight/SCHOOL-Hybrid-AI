import Link from "next/link";
import type { Metadata } from "next";
import { renderMarkdown } from "@/lib/markdown";
import { legalMarkdown } from "@/lib/legalContent";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Terms of Service — SCHOOL",
  description: "The terms governing your use of the SCHOOL academic platform.",
};

export default function TermsPage() {
  const raw = legalMarkdown.terms;
  const html = renderMarkdown(raw);

  return (
    <div className={styles.page}>
      <Link className={styles.back} href="/">← Back home</Link>
      <article
        className={styles.body}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <nav className={styles.nav}>
        <Link className={styles.navLink} href="/legal/privacy">Privacy Policy</Link>
        <Link className={styles.navLink} href="/legal/cookies">Cookie Policy</Link>
        <Link className={styles.navLink} href="/legal/aup">Acceptable Use</Link>
      </nav>
    </div>
  );
}
