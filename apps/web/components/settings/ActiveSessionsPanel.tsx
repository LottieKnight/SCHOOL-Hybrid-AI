"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/apiBase";

type ActiveSession = {
  id: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
};

function parseDevice(ua: string | null): string {
  if (!ua) return "Unknown device";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS device";
  if (/Android/i.test(ua)) return "Android device";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux";
  return "Browser";
}

function parseBrowser(ua: string | null): string {
  if (!ua) return "";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua)) return "Safari";
  return "";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

export function ActiveSessionsPanel() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/sessions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load sessions");
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
      setError("Could not load active sessions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function revoke(sessionId: string) {
    setRevoking(sessionId);
    try {
      await fetch(`${API_BASE}/auth/sessions/${sessionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      setError("Failed to revoke session.");
    } finally {
      setRevoking(null);
    }
  }

  async function revokeAll() {
    setRevokingAll(true);
    try {
      await fetch(`${API_BASE}/auth/sessions/revoke-all`, {
        method: "POST",
        credentials: "include",
      });
      setSessions([]);
    } catch {
      setError("Failed to revoke all sessions.");
    } finally {
      setRevokingAll(false);
    }
  }

  return (
    <div style={{ marginTop: "40px", borderTop: "1px solid var(--border)", paddingTop: "32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h2 style={{ fontSize: "18px", margin: 0 }}>Active sessions</h2>
          <p style={{ color: "var(--text-3)", fontSize: "13px", margin: "4px 0 0" }}>
            Devices currently signed in to your account.
          </p>
        </div>
        {sessions.length > 1 && (
          <button
            onClick={() => void revokeAll()}
            disabled={revokingAll}
            style={{ background: "var(--bg-2)", color: "var(--text-2)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "6px 14px", cursor: "pointer", fontSize: "13px" }}
          >
            {revokingAll ? "Signing out all…" : "Sign out all other devices"}
          </button>
        )}
      </div>

      {loading && <p style={{ color: "var(--text-3)", fontSize: "13px" }}>Loading…</p>}
      {error && <p style={{ color: "#ef4444", fontSize: "13px" }}>{error}</p>}

      {!loading && sessions.length === 0 && !error && (
        <p style={{ color: "var(--text-3)", fontSize: "13px" }}>No active sessions found.</p>
      )}

      <div style={{ display: "grid", gap: "8px" }}>
        {sessions.map((session, index) => {
          const device = parseDevice(session.user_agent);
          const browser = parseBrowser(session.user_agent);
          const label = browser ? `${browser} on ${device}` : device;
          const isFirst = index === 0;

          return (
            <div
              key={session.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 14px", borderRadius: "var(--r-md)",
                background: isFirst ? "var(--inst-primary-alpha, rgba(232, 193, 90,0.08))" : "var(--bg-2)",
                border: `1px solid ${isFirst ? "var(--inst-primary, #e8c15a)" : "var(--border)"}`,
                gap: "0.75rem", flexWrap: "wrap",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>
                  {label}
                  {isFirst && (
                    <span style={{ marginLeft: "8px", fontSize: "11px", background: "var(--inst-primary, #e8c15a)", color: "#0a0a0a", borderRadius: "999px", padding: "1px 7px" }}>
                      This device
                    </span>
                  )}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-3)" }}>
                  {session.ip_address ?? "Unknown IP"} · Signed in {formatDate(session.created_at)}
                </p>
              </div>
              {!isFirst && (
                <button
                  onClick={() => void revoke(session.id)}
                  disabled={revoking === session.id}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "4px 10px", cursor: "pointer", fontSize: "12px", color: "var(--text-2)", whiteSpace: "nowrap" }}
                >
                  {revoking === session.id ? "Signing out…" : "Sign out"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
