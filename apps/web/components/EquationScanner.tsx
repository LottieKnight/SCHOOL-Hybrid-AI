"use client";

import { useState, useRef } from "react";
import styles from "./EquationScanner.module.css";
import { Button } from "@/components/ui/Button";

export function EquationScanner() {
  const [loading, setLoading] = useState(false);
  const [solution, setSolution] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/assistant/ocr", {
          method: "POST",
          body: JSON.stringify({ image: reader.result }),
        });
        const data = await res.json();
        setSolution(data.solution);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Equation Scanner</h3>
      <p className={styles.subtitle}>Upload a photo of a problem to get a step-by-step solution.</p>
      
      {!solution && (
        <div className={styles.actions}>
          <Button variant="gold" onClick={() => fileInputRef.current?.click()} disabled={loading}>
            {loading ? "Analyzing..." : "Scan Problem 📸"}
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            accept="image/*"
            style={{ display: "none" }}
          />
        </div>
      )}

      {solution && (
        <div className={styles.solution}>
          <div className={styles.solHeader}>
            <span>Step-by-Step Solution</span>
            <button onClick={() => setSolution(null)}>✕</button>
          </div>
          <div className={styles.solBody}>{solution}</div>
        </div>
      )}
    </div>
  );
}
