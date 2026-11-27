"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";

export function SidebarLogoutButton() {
  const router = useRouter();
  const { session, refresh } = useSession();
  const [loading, setLoading] = useState(false);

  const readCookie = (name: string) => {
    if (typeof document === "undefined") return null;
    const prefix = `${name}=`;
    const match = document.cookie
      .split(";")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(prefix));
    if (!match) return null;
    return decodeURIComponent(match.slice(prefix.length));
  };

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      let csrfToken = readCookie("saedu_csrf") ?? session?.csrfToken;
      if (!csrfToken) {
        const nextSession = await refresh();
        csrfToken = readCookie("saedu_csrf") ?? nextSession?.csrfToken;
      }

      // Best-effort server logout: even if the API is unreachable the local
      // session must still clear so the button always signs the user out.
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
      }).catch(() => null);
      const { signOutFirebase } = await import("@/lib/firebaseGoogleAuth");
      await signOutFirebase();
    } catch {
      // best-effort — session clears on refresh below
    } finally {
      await refresh();
      router.push("/");
      router.refresh();
      setLoading(false);
    }
  };

  const label = loading ? "Logging out..." : "Logout";

  return (
    <button
      className="sidebar-item sidebar-item--subtle skeu-btn-ghost"
      type="button"
      onClick={handleLogout}
      disabled={loading}
      aria-label={label}
      title={label}
    >
      <span className="side-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path
            d="M6 4.5h8.5c1.4 0 2.5 1.1 2.5 2.5v10.8c0 1.4-1.1 2.5-2.5 2.5H6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M9 4.5v15.8M13.1 12h7M17.4 9.3l2.7 2.7-2.7 2.7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="11.2" cy="12" r="0.9" fill="currentColor" />
        </svg>
      </span>
      <span className="sidebar-item__label">{label}</span>
    </button>
  );
}
