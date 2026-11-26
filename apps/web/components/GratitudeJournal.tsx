"use client";

import { useEffect, useState } from "react";
import styles from "./GratitudeJournal.module.css";
import { Button } from "@/components/ui/Button";

export function GratitudeJournal() {
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<Array<{ content: string; entry_date: string }>>([]);

  useEffect(() => {
    fetch("/api/wellness/journal")
      .then(res => res.json())
      .then(data => {
        setHistory(data.journal ?? []);
        const today = new Date().toISOString().slice(0, 10);
        if (data.journal?.some((e: any) => e.entry_date === today)) {
          setSaved(true);
        }
      });
  }, []);

  const handleSave = () => {
    if (!content.trim()) return;
    fetch("/api/wellness/journal", {
      method: "POST",
      body: JSON.stringify({ content }),
    }).then(() => {
      setSaved(true);
    });
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Daily Reflection</h3>
      <p className={styles.subtitle}>Note one positive thing you learned or experienced today.</p>

      {!saved ? (
        <div className={styles.inputRow}>
          <input
            className={styles.input}
            placeholder="Today I am grateful for..."
            value={content}
            onChange={e => setContent(e.target.value)}
          />
          <Button variant="gold" onClick={handleSave}>Save</Button>
        </div>
      ) : (
        <div className={styles.saved}>
          <span>Reflection saved. Great job today! ✨</span>
        </div>
      )}

      {history.length > 0 && (
        <div className={styles.history}>
          {history.slice(0, 3).map((h, i) => (
            <div key={i} className={styles.historyItem}>
              <span className={styles.date}>{h.entry_date}</span>
              <span className={styles.text}>{h.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
