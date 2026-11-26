"use client";

import Link from "next/link";

type PhoneVerificationBannerProps = {
  nextPath: string;
  message?: string;
};

export function PhoneVerificationBanner({
  nextPath,
  message = "Verify your phone to list tutor services and access tutoring marketplace actions.",
}: PhoneVerificationBannerProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap",
        padding: "14px 16px",
        borderRadius: "var(--r-lg)",
        border: "1px solid rgba(239, 68, 68, 0.24)",
        background: "var(--red-dim)",
      }}
    >
      <span style={{ color: "var(--red)", fontWeight: 700 }}>Verify your phone</span>
      <span style={{ color: "var(--text-2)", flex: "1 1 280px" }}>{message}</span>
      <Link
        href={`/verify-phone?next=${encodeURIComponent(nextPath)}`}
        style={{
          color: "var(--gold)",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          fontWeight: 700,
        }}
      >
        Verify now →
      </Link>
    </div>
  );
}

export default PhoneVerificationBanner;
