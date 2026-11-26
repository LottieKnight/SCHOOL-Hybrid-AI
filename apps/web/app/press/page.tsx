"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LICENSE_LABELS, type WorkLayout } from "@/lib/press/constants";
import { useSession } from "@/components/SessionProvider";
import { getApiErrorMessage } from "@/lib/apiBase";
import { pressClient, type PressWork } from "@/lib/press/pressClient";
import styles from "./page.module.css";

type Filter = "all" | "written" | "gallery";

const KIND_LABELS: Record<string, string> = {
  paper: "Paper",
  essay: "Essay",
  literature: "Literature",
  design: "Design",
  dataset_note: "Dataset note",
  other: "Work",
};

export default function PressHomePage() {
  const { session } = useSession();
  const [filter, setFilter] = useState<Filter>("all");
  const [works, setWorks] = useState<PressWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: Filter) => {
    setLoading(true);
    setError(null);
    try {
      const layout: WorkLayout | undefined = f === "all" ? undefined : f;
      const data = await pressClient.feed(layout);
      setWorks(data.works ?? []);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load SCHOOL Press."));
      setWorks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  return (
    <div className={styles.wrap}>
      <header className={styles.lockup}>
        <div className={styles.mark}>○ ◇ ○</div>
        <h1 className={styles.org}>SCHOOL Press</h1>
        <p className={styles.tagline}>Scholarly &amp; creative works, published by the SCHOOL community.</p>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          {(["all", "written", "gallery"] as Filter[]).map((f) => (
            <button
              key={f}
              className={styles.tab}
              data-active={filter === f}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f === "written" ? "Written" : "Gallery"}
            </button>
          ))}
        </div>
        {session && (
          <Link href="/press/new" className={styles.newBtn}>
            + Publish a work
          </Link>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <p className={styles.muted}>Loading works…</p>
      ) : works.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.muted}>No works published yet.</p>
          {session && (
            <Link href="/press/new" className={styles.newBtn}>
              Be the first to publish →
            </Link>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {works.map((w) => (
            <Link key={w.id} href={`/press/${w.slug}`} className={styles.card} data-layout={w.layout}>
              {w.cover_url && w.layout === "gallery" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={w.cover_url} alt="" className={styles.cover} />
              )}
              <div className={styles.cardBody}>
                <span className={styles.kind}>{KIND_LABELS[w.kind] ?? w.kind}</span>
                <h2 className={styles.cardTitle}>{w.title}</h2>
                {w.abstract && <p className={styles.cardAbstract}>{w.abstract}</p>}
                <div className={styles.cardMeta}>
                  {w.published_at && (
                    <span>
                      {new Date(w.published_at).toLocaleDateString("en-ZA", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  )}
                  <span className={styles.license}>{LICENSE_LABELS[w.license].split(" — ")[0]}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
