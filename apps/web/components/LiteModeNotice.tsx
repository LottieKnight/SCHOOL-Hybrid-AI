"use client";

import { useEffect, useState } from "react";
import { getStoredLiteMode, LITE_MODE_EVENT, setStoredLiteMode } from "@/lib/liteMode";

export function LiteModeNotice() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const sync = () => {
      const stored = getStoredLiteMode();
      setEnabled(stored === true);
      if (stored !== null) document.documentElement.classList.toggle("lite-mode", stored);
    };
    sync();
    window.addEventListener(LITE_MODE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LITE_MODE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div
      style={{
        background: "var(--surface-3)",
        borderBottom: "1px solid var(--border)",
        padding: "8px 12px",
        fontSize: "0.875rem",
        textAlign: "center",
        color: "var(--text-3)",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
      }}
    >
      <span style={{ color: "var(--green)" }} aria-hidden="true">●</span>
      <span>Data Saver is on. Heavy visuals stay off.</span>
      <button type="button" className="button" style={{ minHeight: 44, whiteSpace: "nowrap" }} onClick={() => setStoredLiteMode(false)}>
        Turn off
      </button>
    </div>
  );
}
