import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "You're offline",
  robots: { index: false },
};

export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "var(--bg, #0a0a0a)",
        color: "var(--text-1, #fafafa)",
        fontFamily: "-apple-system, sans-serif",
        textAlign: "center",
        gap: "16px",
      }}
    >
      <div style={{ fontSize: "13px", fontWeight: 800, letterSpacing: "0.1em", color: "var(--text-3, #a3a3a3)" }}>
        SCHOOL
      </div>
      <h1 style={{ fontSize: "24px", fontWeight: 700, margin: 0 }}>You&apos;re offline</h1>
      <p style={{ fontSize: "14px", color: "var(--text-3, #a3a3a3)", maxWidth: "360px", margin: 0, lineHeight: 1.6 }}>
        No internet connection detected. Lessons you already opened can still open, and hybrid tutor hints
        stay on this phone when the on-device model is ready.
      </p>
      <Link
        href="/tutor"
        style={{
          display: "inline-block",
          padding: "12px 24px",
          background: "var(--gold, #e8c15a)",
          color: "#0a0a0a",
          fontWeight: 700,
          fontSize: "14px",
          textDecoration: "none",
          borderRadius: "8px",
        }}
      >
        Open hybrid tutor
      </Link>
      <Link
        href="/"
        style={{
          display: "inline-block",
          padding: "12px 24px",
          background: "var(--text-1, #fafafa)",
          color: "var(--bg, #0a0a0a)",
          fontWeight: 700,
          fontSize: "14px",
          textDecoration: "none",
          borderRadius: "8px",
          marginTop: "8px",
        }}
      >
        Try again
      </Link>
    </div>
  );
}
