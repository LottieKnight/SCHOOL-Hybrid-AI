"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";
import { getStoredLiteMode, LITE_MODE_SUGGESTED_KEY, setStoredLiteMode } from "@/lib/liteMode";

const DEFAULT_ENABLED = process.env.NEXT_PUBLIC_LITE_MODE_DEFAULT === "true";

type ProfileResponse = {
  profile?: {
    liteMode?: boolean;
  };
};

export function LiteModeToggle() {
  const apiBase = API_BASE;
  const { session } = useSession();
  const [enabled, setEnabled] = useState(false);
  const [suggested, setSuggested] = useState(false);

  useEffect(() => {
    const stored = getStoredLiteMode();
    if (stored !== null) {
      setEnabled(stored);
      return;
    }

    const apply = (next: boolean) => {
      setEnabled(next);
      setStoredLiteMode(next);
    };

    if (session) {
      fetch(`${apiBase}/profile/me`, { credentials: "include" })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: ProfileResponse | null) => {
          if (data?.profile?.liteMode !== undefined) {
            apply(Boolean(data.profile.liteMode));
            return;
          }
          apply(DEFAULT_ENABLED);
        })
        .catch(() => {
          apply(DEFAULT_ENABLED);
        });
      return;
    }

    apply(DEFAULT_ENABLED);
  }, [apiBase, session]);

  useEffect(() => {
    if (getStoredLiteMode() !== null) return;
    const connection = (navigator as any)?.connection;
    const saveData = Boolean(connection?.saveData);
    const effectiveType = String(connection?.effectiveType || "");
    const isSlow = saveData || ["slow-2g", "2g"].includes(effectiveType);
    if (!isSlow) return;
    const alreadySuggested = localStorage.getItem(LITE_MODE_SUGGESTED_KEY);
    if (alreadySuggested) return;
    localStorage.setItem(LITE_MODE_SUGGESTED_KEY, "true");
    setSuggested(true);
    setEnabled(true);
    setStoredLiteMode(true);
    if (session) {
      fetch(`${apiBase}/profile/me`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({ liteMode: true }),
      }).catch(() => {
        // ignore
      });
    }
  }, [apiBase, session]);

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    setStoredLiteMode(next);
    setSuggested(false);

    if (!session) return;
    await fetch(`${apiBase}/profile/me`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": session.csrfToken,
      },
      body: JSON.stringify({ liteMode: next }),
    }).catch(() => {
      // ignore
    });
  };

  return (
    <div className="lite-toggle">
      <button className="button" onClick={toggle} type="button">
        {enabled ? "Lite Mode: On" : "Lite Mode: Off"}
      </button>
      {suggested && <span className="lite-suggest">Recommended on your connection</span>}
    </div>
  );
}
