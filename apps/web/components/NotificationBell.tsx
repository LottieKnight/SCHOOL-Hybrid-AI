"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { relativeTime } from "@/lib/relativeTime";
import { useSession } from "@/components/SessionProvider";

type AppNotification = {
  id: string;
  type: string;
  title: string;
  link: string | null;
  message: string;
  created_at: string;
};

export function NotificationBell() {
  const { isIdle } = useSession();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { notifications: AppNotification[] };
      setNotifications(data.notifications ?? []);
    } catch {
      // ignore network errors
    }
  }, []);

  useEffect(() => {
    if (isIdle) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [isIdle, fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  async function handleOpen() {
    setOpen((prev) => !prev);
    if (!open && notifications.length > 0) {
      setNotifications([]);
      await fetch("/api/notifications", { method: "POST" }).catch(() => null);
    }
  }

  const count = notifications.length;

  return (
    <div ref={panelRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={count > 0 ? `${count} unread notifications` : "Notifications"}
        style={{
          position: "relative",
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: "999px",
          padding: "6px 10px",
          fontFamily: "var(--font-mono)",
          fontSize: "13px",
          color: "var(--text-2)",
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        🔔
        {count > 0 ? (
          <span
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              minWidth: "16px",
              height: "16px",
              borderRadius: "999px",
              background: "#ef4444",
              color: "#fff",
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
              lineHeight: 1,
            }}
          >
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: "300px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            boxShadow: "var(--sh-lg)",
            zIndex: 200,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 14px 10px",
              borderBottom: "1px solid var(--border)",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-3)",
            }}
          >
            Notifications
          </div>
          {notifications.length === 0 ? (
            <div style={{ padding: "20px 14px", color: "var(--text-3)", fontSize: "13px", textAlign: "center" }}>
              You're all caught up.
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: "320px", overflowY: "auto" }}>
              {notifications.map((n) => (
                <li
                  key={n.id}
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    gap: "10px",
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}>
                    {n.type === "answer_accepted" ? "✅"
                     : n.type === "same_question_resolved" ? "💡"
                     : n.type === "comment_on_post" ? "💬"
                     : n.type === "reaction_on_post" ? "⚡"
                     : n.type === "achievement_unlocked" ? "🏅"
                     : n.type === "weekly_wrap" ? "📊"
                     : "🔔"}
                  </span>
                  <div style={{ display: "grid", gap: "4px" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-1)", lineHeight: 1.4 }}>{n.message}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-3)" }}>
                      {relativeTime(n.created_at)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
