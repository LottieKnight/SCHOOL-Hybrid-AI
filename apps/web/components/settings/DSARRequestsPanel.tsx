"use client";

// Self-serve POPIA Subject Access Requests (DSAR).
// §23 access: request a copy of your personal data (also available instantly
//             via the export link).
// §24 erasure: request deletion of your data — handled by the DPO under the
//              30-day statutory clock.
// The panel lists the user's own pending/closed requests from GET /dsar/mine.

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/apiBase";

type DsarRow = {
  id: string;
  request_type: "access" | "erasure";
  status: "pending" | "in_progress" | "fulfilled" | "rejected" | "erased";
  details: string | null;
  sla_due_at: string;
  fulfilled_at: string | null;
  created_at: string;
};

function fmt(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }).format(d);
}

function durationTo(due: string) {
  const diff = new Date(due).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "due today";
  return `${days}d left`;
}

const STATUS_LABEL: Record<DsarRow["status"], string> = {
  pending: "Pending",
  in_progress: "In progress",
  fulfilled: "Fulfilled",
  rejected: "Declined",
  erased: "Erased",
};

const STATUS_COLOR: Record<DsarRow["status"], string> = {
  pending: "#f59e0b",
  in_progress: "#3b82f6",
  fulfilled: "#22c55e",
  rejected: "#ef4444",
  erased: "#e8c15a",
};

export function DSARRequestsPanel() {
  const [requests, setRequests] = useState<DsarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState("");
  const [submittingAccess, setSubmittingAccess] = useState(false);
  const [submittingErasure, setSubmittingErasure] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function loadMine() {
    try {
      const res = await fetch(`${API_BASE}/dsar/mine`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setRequests(data.records ?? []);
      }
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMine();
  }, []);

  async function lodge(type: "access" | "erasure") {
    const handler = type === "access" ? setSubmittingAccess : setSubmittingErasure;
    handler(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/dsar/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ details: details.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setMessage({ type: "err", text: data.error || "Unable to lodge the request." });
        return;
      }
      setDetails("");
      setMessage(
        type === "access"
          ? { type: "ok", text: "Access request lodged. You may also download your data instantly via the link below." }
          : { type: "ok", text: "Erasure request lodged. Our Data Protection Officer will action it within 30 days." }
      );
      await loadMine();
    } catch {
      setMessage({ type: "err", text: "Unable to connect. Please try again." });
    } finally {
      handler(false);
    }
  }

  const hasOpen = requests.some((r) => r.status === "pending" || r.status === "in_progress");

  return (
    <div style={{ marginTop: "40px", borderTop: "1px solid var(--border)", paddingTop: "32px" }}>
      <h2 style={{ color: "var(--text-1)", fontSize: "18px", marginBottom: "8px" }}>Your privacy & data</h2>
      <p style={{ color: "var(--text-3)", fontSize: "13px", marginBottom: "16px" }}>
        Under POPIA you can request a copy of your personal data (access) or request that it be deleted
        (erasure). Requests are logged and answered within 30 days.
      </p>

      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "16px" }}>
        <a href={`${API_BASE}/profile/data-export`} style={{ fontSize: "13px", color: "var(--inst-primary)", textDecoration: "underline" }}>
          Download a copy of my data now
        </a>
        <a href="/legal/paia" style={{ fontSize: "13px", color: "var(--text-2)", textDecoration: "underline" }}>
          PAIA / Privacy manual
        </a>
      </div>

      <div style={{ display: "grid", gap: "8px", maxWidth: "420px", marginBottom: "20px" }}>
        <textarea
          placeholder="Optional: tell us what data this relates to (max ~500 chars)."
          value={details}
          maxLength={500}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          style={{ padding: "8px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", fontSize: "13px", resize: "vertical" }}
        />
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={submittingAccess || submittingErasure}
            style={{ background: "var(--inst-primary)", color: "#0a0a0a", border: "none", borderRadius: "var(--r-md)", padding: "8px 14px", cursor: "pointer", fontSize: "13px" }}
            onClick={() => void lodge("access")}
          >
            {submittingAccess ? "Requesting…" : "Request my data (access)"}
          </button>
          <button
            type="button"
            disabled={submittingAccess || submittingErasure}
            style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: "var(--r-md)", padding: "8px 14px", cursor: "pointer", fontSize: "13px" }}
            onClick={() => {
              if (window.confirm("Request deletion of your data? This is handled by our DPO and may involve suspending your account.")) {
                void lodge("erasure");
              }
            }}
          >
            {submittingErasure ? "Requesting…" : "Request deletion (erasure)"}
          </button>
        </div>
      </div>

      {message ? (
        <p style={{ color: message.type === "ok" ? "#22c55e" : "#ef4444", fontSize: "12.5px", margin: "0 0 12px" }}>{message.text}</p>
      ) : null}

      <p style={{ color: "var(--text-3)", fontSize: "12.5px", margin: "0 0 8px" }}>
        {loading ? "Loading your requests…" : hasOpen ? "Open request(s) below." : "No open data requests."}
      </p>

      {requests.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                {["Type", "Status", "SLA", "Lodged", "Fulfilled", "Details"].map((h) => (
                  <th key={h} style={{ padding: "6px 8px", textAlign: "left", opacity: 0.7, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>{r.request_type === "access" ? "Access" : "Erasure"}</td>
                  <td style={{ padding: "5px 8px", whiteSpace: "nowrap", color: STATUS_COLOR[r.status], fontWeight: 600 }}>{STATUS_LABEL[r.status]}</td>
                  <td style={{ padding: "5px 8px", whiteSpace: "nowrap", opacity: 0.85 }}>{durationTo(r.sla_due_at)}</td>
                  <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>{fmt(r.created_at)}</td>
                  <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>{fmt(r.fulfilled_at)}</td>
                  <td style={{ padding: "5px 8px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.details ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}