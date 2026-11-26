"use client";

// Data Protection (POPIA) console for the operator / DPO.
//   § DSAR queue: subject access requests under the 30-day SLA clock
//     (fulfill access, reject, execute §24 erasure).
//   § Retention policy: operator-overridable data-retention windows (POPIA §14).
//
// Routes proxy to the API backend via /api/admin/... (see next.config rewrites),
// which forwards the auth/session cookie.

import { useEffect, useState } from "react";
import { AdminQuickLinks } from "@/components/AdminQuickLinks";

type DsarRow = {
  id: string;
  request_type: "access" | "erasure";
  status: "pending" | "in_progress" | "fulfilled" | "rejected" | "erased";
  details: string | null;
  sla_due_at: string;
  snapshot_path: string | null;
  fulfilled_at: string | null;
  fulfilled_notes: string | null;
  created_at: string;
};

type RetentionPolicy = {
  policy_key: string;
  display_name: string;
  policy_value_years: string | null;
  effective_from: string | null;
  updated_at: string;
};

function fmt(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
}

function durationTo(due: string) {
  const diff = new Date(due).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "due today";
  return `${days}d left`;
}

const STATUS_BADGE: Record<DsarRow["status"], string> = {
  pending: "#f59e0b",
  in_progress: "#3b82f6",
  fulfilled: "#22c55e",
  rejected: "#ef4444",
  erased: "#e8c15a",
};

export default function DataProtectionPage() {
  const [dsars, setDsars] = useState<DsarRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [policyDraft, setPolicyDraft] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  async function loadDsars(status: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/dsar${params.toString() ? `?${params}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setDsars(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError("Could not load the DSAR queue.");
    } finally {
      setLoading(false);
    }
  }

  async function loadPolicies() {
    try {
      const res = await fetch("/api/admin/retention/policies", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setPolicies(data.policies ?? []);
      const draft: Record<string, string> = {};
      for (const p of data.policies ?? []) {
        draft[p.policy_key] = p.policy_value_years ?? "";
      }
      setPolicyDraft(draft);
    } catch {
      /* retention manifest failure is non-fatal */
    }
  }

  useEffect(() => {
    void loadDsars(statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    void loadPolicies();
  }, []);

  async function runAction(id: string, action: "fulfill" | "reject" | "erasure") {
    if (action === "erasure") {
      const ok = window.confirm("Confirm §24 erasure? This anonymises and suspends the subject's account permanently.");
      if (!ok) return;
    }
    const notes = window.prompt(`Optional operator note for ${action}:`) ?? "";
    const snapshotPath = action === "fulfill" ? (window.prompt("Snapshot path (optional):") ?? "") : "";
    setActionBusy(id);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (notes.trim()) body.notes = notes.trim();
      if (snapshotPath.trim()) body.snapshotPath = snapshotPath.trim();
      const res = await fetch(`/api/admin/dsar/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error ?? `Failed (${action})`);
      }
      await loadDsars(statusFilter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setActionBusy(null);
    }
  }

  async function savePolicy(key: string) {
    const years = Number(policyDraft[key] ?? "");
    if (!Number.isFinite(years) || years < 0 || years > 50) {
      setError("Retention years must be between 0 and 50.");
      return;
    }
    setBusyKey(key);
    setError(null);
    try {
      const res = await fetch(`/api/admin/retention/policies/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ years }),
      });
      if (!res.ok) throw new Error("Failed to update policy");
      await loadPolicies();
    } catch {
      setError("Could not update the retention policy.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="glass card card-with-back">
      <h1 className="title">Data protection (POPIA)</h1>
      <p className="subtitle">Subject access requests and data-retention policy manager.</p>
      <AdminQuickLinks />
      <div className="spacer" />

      {error && <p style={{ color: "#ef4444", marginBottom: "0.75rem" }}>{error}</p>}

      <h2 className="title" style={{ fontSize: "1.05rem", marginBottom: "0.25rem" }}>Subject access requests</h2>
      <p className="subtitle" style={{ marginBottom: "0.5rem" }}>{total} request(s). Statutory response clock is 30 days.</p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        {["", "pending", "in_progress", "fulfilled", "rejected", "erased"].map((s) => (
          <button
            key={s || "all"}
            className="button"
            onClick={() => setStatusFilter(s)}
            style={statusFilter === s ? {} : { background: "transparent", boxShadow: "none", color: "inherit", border: "1px solid var(--border)" }}
          >
            {s === "" ? "All" : s}
          </button>
        ))}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border)" }}>
              {["Type", "Status", "SLA", "Lodged", "Details", "Snapshot", "Actions"].map((h) => (
                <th key={h} style={{ padding: "6px 8px", textAlign: "left", opacity: 0.7, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dsars.length === 0 && !loading && (
              <tr><td colSpan={7} style={{ padding: "1rem", textAlign: "center", opacity: 0.6 }}>No requests found.</td></tr>
            )}
            {dsars.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>
                  <span style={{ background: r.request_type === "access" ? "rgba(59,130,246,0.15)" : "rgba(232, 193, 90,0.15)", color: r.request_type === "access" ? "#3b82f6" : "#e8c15a", padding: "2px 8px", borderRadius: "var(--r-sm)", fontWeight: 600 }}>
                    {r.request_type === "access" ? "§23 Access" : "§24 Erasure"}
                  </span>
                </td>
                <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>
                  <span style={{ color: STATUS_BADGE[r.status], fontWeight: 600 }}>{r.status}</span>
                </td>
                <td style={{ padding: "5px 8px", whiteSpace: "nowrap", opacity: 0.85 }}>{durationTo(r.sla_due_at)}</td>
                <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>{fmt(r.created_at)}</td>
                <td style={{ padding: "5px 8px", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.details ?? "—"}</td>
                <td style={{ padding: "5px 8px", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace", fontSize: "0.72rem" }}>{r.snapshot_path ?? "—"}</td>
                <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>
                  {r.status === "pending" || r.status === "in_progress" ? (
                    r.request_type === "erasure" ? (
                      <button className="button" disabled={actionBusy === r.id} style={{ fontSize: "0.72rem", color: "#ef4444" }} onClick={() => void runAction(r.id, "erasure")}>
                        {actionBusy === r.id ? "…" : "Erase"}
                      </button>
                    ) : (
                      <span style={{ display: "flex", gap: "0.35rem" }}>
                        <button className="button" disabled={actionBusy === r.id} style={{ fontSize: "0.72rem" }} onClick={() => void runAction(r.id, "fulfill")}>
                          {actionBusy === r.id ? "…" : "Fulfill"}
                        </button>
                        <button className="button" disabled={actionBusy === r.id} style={{ fontSize: "0.72rem" }} onClick={() => void runAction(r.id, "reject")}>
                          {actionBusy === r.id ? "…" : "Reject"}
                        </button>
                      </span>
                    )
                  ) : (
                    <span style={{ opacity: 0.5 }}>{r.fulfilled_at ? fmt(r.fulfilled_at) : "Closed"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="spacer" />

      <h2 className="title" style={{ fontSize: "1.05rem", marginBottom: "0.25rem" }}>Retention policy</h2>
      <p className="subtitle" style={{ marginBottom: "0.5rem" }}>Windows enforced by the data-retention cron (POPIA §14). Unset values use code defaults.</p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border)" }}>
              {["Policy", "Years", "Effective", "Action"].map((h) => (
                <th key={h} style={{ padding: "6px 8px", textAlign: "left", opacity: 0.7, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {policies.length === 0 && (
              <tr><td colSpan={4} style={{ padding: "1rem", textAlign: "center", opacity: 0.6 }}>No retention policies configured.</td></tr>
            )}
            {policies.map((p) => (
              <tr key={p.policy_key} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "5px 8px" }}>
                  <div style={{ fontWeight: 600 }}>{p.display_name}</div>
                  <div style={{ fontFamily: "monospace", fontSize: "0.7rem", opacity: 0.6 }}>{p.policy_key}</div>
                </td>
                <td style={{ padding: "5px 8px" }}>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={policyDraft[p.policy_key] ?? ""}
                    onChange={(e) => setPolicyDraft((d) => ({ ...d, [p.policy_key]: e.target.value }))}
                    style={{ width: "80px", padding: "4px 8px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", fontSize: "13px" }}
                  />
                </td>
                <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>{fmt(p.effective_from)}</td>
                <td style={{ padding: "5px 8px" }}>
                  <button className="button" disabled={busyKey === p.policy_key} style={{ fontSize: "0.72rem" }} onClick={() => void savePolicy(p.policy_key)}>
                    {busyKey === p.policy_key ? "Saving…" : "Save"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}