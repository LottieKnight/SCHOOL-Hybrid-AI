"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { pressClient, type PressWork } from "@/lib/press/pressClient";
import styles from "./PressPublications.module.css";

const KIND_LABELS: Record<string, string> = {
  paper: "Paper",
  essay: "Essay",
  literature: "Literature",
  design: "Design",
  dataset_note: "Dataset note",
  other: "Work",
};

/**
 * The author's "body of work" — the academia.edu-style bibliography on a public
 * profile. Owners also see drafts/withdrawn (the API returns them when the
 * viewer is the author).
 */
export function PressPublications({ username, isSelf }: { username: string; isSelf: boolean }) {
  const [works, setWorks] = useState<PressWork[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    pressClient
      .authorWorks(username)
      .then((d) => {
        if (active) setWorks(d.works ?? []);
      })
      .catch(() => {
        if (active) setWorks([]);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [username]);

  // Hide entirely for visitors when there's nothing to show.
  if (loaded && works.length === 0 && !isSelf) return null;

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>Publications</h2>
        {isSelf && (
          <Link href="/press/new" className={styles.newLink}>
            + Publish
          </Link>
        )}
      </div>

      {!loaded ? (
        <p className={styles.muted}>Loading…</p>
      ) : works.length === 0 ? (
        <p className={styles.muted}>
          No publications yet.{" "}
          {isSelf && (
            <Link href="/press/new" className={styles.inlineLink}>
              Publish your first work →
            </Link>
          )}
        </p>
      ) : (
        <ul className={styles.list}>
          {works.map((w) => (
            <li key={w.id} className={styles.item}>
              <Link href={`/press/${w.slug}`} className={styles.itemLink}>
                <span className={styles.itemKind}>{KIND_LABELS[w.kind] ?? w.kind}</span>
                <span className={styles.itemTitle}>{w.title}</span>
                {w.status !== "published" && w.status !== "curated" && (
                  <span className={styles.statusTag} data-status={w.status}>
                    {w.status}
                  </span>
                )}
                {w.published_at && (
                  <span className={styles.itemDate}>
                    {new Date(w.published_at).getFullYear()}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
