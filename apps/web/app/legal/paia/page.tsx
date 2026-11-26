import Link from "next/link";
import type { Metadata } from "next";
import { renderMarkdown } from "@/lib/markdown";
import { paiaMarkdown } from "@/lib/legalContentPaia";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "PAIA Manual — SCHOOL",
  description:
    "Promotion of Access to Information Act (PAIA) Section 51 manual for DITSHEGO VENTURES (Pty) Ltd t/a SCHOOL.",
};

export default function PaiaPage() {
  const html = renderMarkdown(paiaMarkdown);

  return (
    <div className={styles.page}>
      <Link className={styles.back} href="/">
        ← Back home
      </Link>
      <article
        className={styles.body}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <nav className={styles.nav}>
        <Link className={styles.navLink} href="/legal/privacy">
          Privacy Policy
        </Link>
        <Link className={styles.navLink} href="/legal/terms">
          Terms of Service
        </Link>
        <Link className={styles.navLink} href="/legal/cookies">
          Cookie Policy
        </Link>
        <Link className={styles.navLink} href="/legal/aup">
          Acceptable Use
        </Link>
      </nav>
    </div>
  );
}
