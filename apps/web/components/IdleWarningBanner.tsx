"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";

export function IdleWarningBanner() {
  const { showWarning, resetTimer } = useSession();
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (!showWarning) {
      setCountdown(60);
      return;
    }
    setCountdown(60);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showWarning]);

  if (!showWarning) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: "fixed",
        bottom: "80px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 350,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 18px",
        background: "color-mix(in srgb, var(--gold, #f5a623) 12%, var(--surface, #1a1a2e))",
        border: "1px solid color-mix(in srgb, var(--gold, #f5a623) 40%, transparent)",
        borderRadius: "999px",
        color: "var(--text-1, #fff)",
        fontSize: "14px",
        fontWeight: 500,
        boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
        whiteSpace: "nowrap",
      }}
    >
      <span>You&apos;ve been inactive — logging out in {countdown}s</span>
      <button
        type="button"
        onClick={resetTimer}
        style={{
          padding: "4px 14px",
          background: "var(--gold, #f5a623)",
          border: "none",
          borderRadius: "999px",
          color: "#000",
          fontWeight: 700,
          fontSize: "13px",
          cursor: "pointer",
        }}
      >
        Stay logged in
      </button>
    </div>
  );
}
