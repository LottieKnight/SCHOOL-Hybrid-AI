"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { API_BASE } from "@/lib/apiBase";

const DISMISSED_KEY = "school_referral_banner_dismissed";

export function PostOnboardingReferralBanner() {
  const searchParams = useSearchParams();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isPostOnboarding = searchParams.get("onboarding_complete") === "1";
    const alreadyDismissed = typeof window !== "undefined"
      ? sessionStorage.getItem(DISMISSED_KEY) === "1"
      : false;

    if (!isPostOnboarding || alreadyDismissed) return;

    fetch(`${API_BASE}/referrals/my-code`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { shareUrl?: string } | null) => {
        if (data?.shareUrl) {
          setShareUrl(data.shareUrl);
          setVisible(true);
        }
      })
      .catch(() => {});
  }, [searchParams]);

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  };

  const copy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const shareWhatsApp = () => {
    if (!shareUrl) return;
    const text = `Join me on SCHOOL! Use my link to get bonus credits: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  if (!visible || !shareUrl) return null;

  return (
    <div
      role="banner"
      style={{
        background: "var(--accent, #e8c15a)",
        color: "#0a0a0a",
        padding: "12px 16px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "12px",
        fontSize: "14px",
      }}
    >
      <span style={{ flex: 1, minWidth: "200px" }}>
        Welcome aboard! Share your referral link and earn credits when friends join.
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        <button
          onClick={copy}
          style={{
            background: "rgba(255,255,255,0.2)",
            border: "1px solid rgba(255,255,255,0.4)",
            color: "#fff",
            padding: "6px 14px",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        <button
          onClick={shareWhatsApp}
          style={{
            background: "rgba(255,255,255,0.2)",
            border: "1px solid rgba(255,255,255,0.4)",
            color: "#fff",
            padding: "6px 14px",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          Share on WhatsApp
        </button>
        <button
          onClick={dismiss}
          aria-label="Dismiss referral banner"
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(255,255,255,0.7)",
            cursor: "pointer",
            fontSize: "18px",
            lineHeight: 1,
            padding: "0 4px",
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
