"use client";

import { useEffect, useState } from "react";
import { getStoredLiteMode } from "@/lib/liteMode";

export function LessonVideoPlaceholder() {
  const [liteMode, setLiteMode] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const stored = getStoredLiteMode();
    const isLite = stored ?? document.documentElement.classList.contains("lite-mode");
    setLiteMode(isLite);
    if (!isLite) setShow(true);
  }, []);

  if (!show && !liteMode) return null;

  return (
    <div className="week-card">
      {!show && liteMode ? (
        <button type="button" className="button" onClick={() => setShow(true)}>
          Load video
        </button>
      ) : (
        <p className="badge">Video placeholder. Tap “Load video” in Lite Mode to show.</p>
      )}
    </div>
  );
}
