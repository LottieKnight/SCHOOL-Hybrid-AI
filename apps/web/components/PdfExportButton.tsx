"use client";

import styles from "./PdfExportButton.module.css";

export function PdfExportButton() {
  const handleExport = () => {
    // For now, we use window.print() which allows saving as PDF
    window.print();
  };

  return (
    <button className={styles.exportBtn} onClick={handleExport}>
      <span className={styles.icon}>📄</span>
      <span>Export Learning Journey (PDF)</span>
    </button>
  );
}
