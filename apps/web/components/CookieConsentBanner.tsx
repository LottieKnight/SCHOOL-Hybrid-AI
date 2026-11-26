"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const STORAGE_KEY = "school_cookie_consent";

export function CookieConsentBanner() {
  const t = useTranslations("banners");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch { /* storage unavailable */ }
  }, []);

  function accept(choice: "all" | "essential") {
    try { localStorage.setItem(STORAGE_KEY, choice); } catch { /* ignore */ }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: "fixed",
        bottom: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: "var(--bg-card, #1a1a1a)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg, 12px)",
        padding: "16px 20px",
        maxWidth: "520px",
        width: "calc(100% - 32px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        display: "grid",
        gap: "12px",
      }}
    >
      <p style={{ margin: 0, fontSize: "13px", color: "var(--text-2)", lineHeight: 1.5 }}>
        {t("cookieMessage")}
        {" "}
        <a href="/legal/cookies" style={{ color: "var(--inst-primary)", textDecoration: "underline" }}>{t("cookiePolicy")}</a>.
      </p>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => accept("all")}
          style={{ background: "var(--inst-primary, #e8c15a)", color: "#0a0a0a", border: "none", borderRadius: "var(--r-md, 8px)", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
        >
          {t("cookieAccept")}
        </button>
        <button
          type="button"
          onClick={() => accept("essential")}
          style={{ background: "var(--bg-2)", color: "var(--text-2)", border: "1px solid var(--border)", borderRadius: "var(--r-md, 8px)", padding: "8px 16px", fontSize: "13px", cursor: "pointer" }}
        >
          {t("cookieEssentialOnly")}
        </button>
      </div>
    </div>
  );
}
