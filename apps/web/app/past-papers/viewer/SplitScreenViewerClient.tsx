"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./SplitScreenViewer.module.css";

type Props = {
  paperUrl: string;
  memoUrl?: string;
  title: string;
  backUrl: string;
};

export function SplitScreenViewerClient({ paperUrl, memoUrl, title, backUrl }: Props) {
  const [viewMode, setViewMode] = useState<"single" | "split" | "notes">(memoUrl ? "split" : "single");
  const [notes, setNotes] = useState("");
  const [savedTime, setSavedTime] = useState<string | null>(null);

  // Storage key for notes based on title
  const storageKey = `school_pp_notes_${title.replace(/\s+/g, "_")}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setNotes(saved);
    } catch {}
  }, [storageKey]);

  const handleNotesChange = (val: string) => {
    setNotes(val);
    try {
      localStorage.setItem(storageKey, val);
      setSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch {}
  };

  return (
    <section className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.navGroup}>
          <Link className="button" href={backUrl}>
            ← Back
          </Link>
          <span className={styles.paperTitle}>{title}</span>
        </div>

        <div className={styles.modeGroup}>
          <button
            className={`button ${viewMode === "single" ? "btn-primary" : ""}`}
            onClick={() => setViewMode("single")}
          >
            Single View
          </button>

          {memoUrl && (
            <button
              className={`button ${viewMode === "split" ? "btn-primary" : ""}`}
              onClick={() => setViewMode("split")}
            >
              ⚡ Split-Screen (Paper + Memo)
            </button>
          )}

          <button
            className={`button ${viewMode === "notes" ? "btn-primary" : ""}`}
            onClick={() => setViewMode("notes")}
          >
            📝 Paper + Sticky Notes
          </button>
        </div>

        <div className={styles.actionGroup}>
          <a className="button" href={paperUrl} target="_blank" rel="noreferrer">
            Paper ↗
          </a>
          {memoUrl && (
            <a className="button" href={memoUrl} target="_blank" rel="noreferrer">
              Memo ↗
            </a>
          )}
        </div>
      </div>

      <div className={styles.viewerGrid} data-mode={viewMode}>
        {/* Main Paper View */}
        <div className={styles.pane}>
          <div className={styles.paneHeader}>
            <span>📜 Question Paper</span>
          </div>
          <iframe title={`${title} - Question Paper`} src={paperUrl} className={styles.iframe} />
        </div>

        {/* Memo View in Split Mode */}
        {viewMode === "split" && memoUrl && (
          <div className={styles.pane}>
            <div className={styles.paneHeader}>
              <span>✅ Memorandum</span>
            </div>
            <iframe title={`${title} - Memo`} src={memoUrl} className={styles.iframe} />
          </div>
        )}

        {/* Notes View in Notes Mode */}
        {viewMode === "notes" && (
          <div className={styles.notesPane}>
            <div className={styles.paneHeader}>
              <span>📝 Study Notes & Working Out</span>
              {savedTime && <span className={styles.savedTag}>Saved at {savedTime}</span>}
            </div>
            <textarea
              className={styles.notesInput}
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Write your calculations, key points, formula steps, or question notes here... Auto-saved locally!"
            />
          </div>
        )}
      </div>
    </section>
  );
}
