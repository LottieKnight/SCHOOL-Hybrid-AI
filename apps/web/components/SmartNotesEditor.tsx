"use client";

import { useState, useRef } from "react";
import styles from "./SmartNotesEditor.module.css";

const ACADEMIC_TERMS = ["Macroeconomics", "GDP", "Inflation", "Supply", "Demand", "Mitochondria", "Nucleus"];

export function SmartNotesEditor() {
  const [content, setContent] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);

  const handleBlur = () => {
    if (!editorRef.current) return;
    let html = editorRef.current.innerText;
    
    ACADEMIC_TERMS.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      html = html.replace(regex, `<span class="${styles.highlight}">${term}</span>`);
    });

    editorRef.current.innerHTML = html;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h4 className={styles.title}>Smart Notes</h4>
        <span className={styles.hint}>Auto-linking active</span>
      </div>
      <div
        ref={editorRef}
        className={styles.editor}
        contentEditable
        onBlur={handleBlur}
        aria-label="Start typing your study notes here..."
        data-placeholder="Start typing your study notes here..."
      />
    </div>
  );
}
