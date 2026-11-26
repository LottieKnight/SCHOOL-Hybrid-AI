"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "@/components/SessionProvider";
import { API_BASE } from "@/lib/apiBase";

const RESEND_COOLDOWN_SECONDS = 60;

export function EmailVerificationBanner() {
  const t = useTranslations("banners");
  const { session, loading } = useSession();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  if (loading || dismissed || !session) return null;
  if (session.user.isEmailVerified) return null;

  async function resend() {
    setSending(true);
    setError(null);
    setSentMessage(null);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-email`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setSentMessage(t("emailSent", { email: session!.user.email }));
        setCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? t("emailSendError"));
      }
    } catch {
      setError(t("emailNetworkError"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      role="alert"
      style={{
        background: "var(--color-warning-surface, #7c5c00)",
        color: "var(--color-warning-text, #fff8e1)",
        padding: "0.6rem 1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        flexWrap: "wrap",
        fontSize: "0.875rem",
      }}
    >
      <span style={{ flex: 1 }}>
        {sentMessage
          ? sentMessage
          : t("emailVerifyMessage", { email: session.user.email })}
      </span>

      <button
        onClick={resend}
        disabled={sending || cooldown > 0}
        style={{
          background: "rgba(255,255,255,0.15)",
          border: "1px solid rgba(255,255,255,0.3)",
          color: "inherit",
          borderRadius: "0.25rem",
          padding: "0.2rem 0.6rem",
          cursor: cooldown > 0 ? "default" : "pointer",
          fontSize: "0.8rem",
          whiteSpace: "nowrap",
          opacity: cooldown > 0 ? 0.6 : 1,
        }}
      >
        {sending ? t("emailSending") : cooldown > 0 ? t("emailResendCooldown", { cooldown }) : t("emailResend")}
      </button>

      {error && <span style={{ color: "#ffb3b3", fontSize: "0.8rem" }}>{error}</span>}

      <button
        onClick={() => setDismissed(true)}
        aria-label={t("emailDismiss")}
        style={{
          background: "none",
          border: "none",
          color: "inherit",
          cursor: "pointer",
          fontSize: "1rem",
          padding: "0 0.25rem",
          opacity: 0.7,
        }}
      >
        ✕
      </button>
    </div>
  );
}
