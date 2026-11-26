import Link from "next/link";
import type { Metadata } from "next";
import { renderMarkdown } from "@/lib/markdown";
import { legalMarkdown } from "@/lib/legalContent";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Cookie Policy — SCHOOL",
  description: "How SCHOOL uses cookies and similar technologies.",
};

export default function CookiesPage() {
  const raw = legalMarkdown.cookies;
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
        <Link className={styles.navLink} href="/legal/terms">Terms of Service</Link>
        <Link className={styles.navLink} href="/legal/aup">Acceptable Use</Link>
      </nav>
    </div>
  );
}
