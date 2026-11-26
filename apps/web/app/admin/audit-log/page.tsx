"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminQuickLinks } from "@/components/AdminQuickLinks";

type AuditRow = {
  id: string;
  user_id: string | null;
  actor_id: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(new Date(value));
}

const LIMIT = 50;

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({});

  async function load(filters: Record<string, string>, off: number) {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(off) });
      if (filters.userId) params.set("userId", filters.userId);
      if (filters.action) params.set("action", filters.action);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      const res = await fetch(`/api/admin/audit-log?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setRows(data.rows);
      setTotal(data.total);
      setOffset(off);
    } catch {
      setError("Failed to load audit log. Check admin access.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load({}, 0); }, []);

  async function exportLog(format: "csv" | "json") {
    setLoading(true);
    try {
      const params = new URLSearchParams({ format });
      if (appliedFilters.userId) params.set("userId", appliedFilters.userId);
      if (appliedFilters.action) params.set("action", appliedFilters.action);
      if (appliedFilters.from) params.set("from", appliedFilters.from);
      if (appliedFilters.to) params.set("to", appliedFilters.to);
      const res = await fetch(`/api/admin/audit-log/export?${params}`, { credentials: "include" });
      if (!res.ok) {
        setError("Export failed.");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const download = document.createElement("a");
      download.href = URL.createObjectURL(blob);
      download.download = match ? match[1] : `audit-log.${format}`;
      document.body.appendChild(download);
      download.click();
      download.remove();
      URL.revokeObjectURL(download.href);
    } catch {
      setError("Export failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const filters = { userId, action, from, to };
    setAppliedFilters(filters);
    void load(filters, 0);
  }

  return (
    <div className="glass card card-with-back">
      <h1 className="title">Audit log</h1>
      <p className="subtitle">Security-critical events across the platform.</p>
      <AdminQuickLinks />
      <div className="spacer" />

      <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <input placeholder="User ID (UUID)" value={userId} onChange={(e) => setUserId(e.target.value)}
          style={{ flex: "1 1 200px", padding: "6px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", fontSize: "13px" }} />
        <input placeholder="Action (e.g. auth.login)" value={action} onChange={(e) => setAction(e.target.value)}
          style={{ flex: "1 1 160px", padding: "6px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", fontSize: "13px" }} />
        <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)}
          style={{ flex: "1 1 160px", padding: "6px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", fontSize: "13px" }} />
        <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)}
          style={{ flex: "1 1 160px", padding: "6px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", fontSize: "13px" }} />
        <button className="button" type="submit" disabled={loading}>{loading ? "Loading…" : "Filter"}</button>
        <button type="button" className="button" onClick={() => { setUserId(""); setAction(""); setFrom(""); setTo(""); setAppliedFilters({}); void load({}, 0); }}>Clear</button>
        <span style={{ width: "8px" }} />
        <button
          type="button"
          className="button"
          onClick={() => exportLog("json")}
          disabled={loading}
          title="Download the filtered audit log as JSON"
        >
          Export JSON
        </button>
        <button
          type="button"
          className="button"
          onClick={() => exportLog("csv")}
          disabled={loading}
          title="Download the filtered audit log as CSV"
        >
          Export CSV
        </button>
      </form>

      {error && <p style={{ color: "#ef4444" }}>{error}</p>}

      <p className="subtitle" style={{ marginBottom: "0.5rem" }}>{total} events total</p>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border)" }}>
              {["Time", "Action", "User ID", "Actor ID", "IP", "Metadata"].map((h) => (
                <th key={h} style={{ padding: "6px 8px", textAlign: "left", opacity: 0.7, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr><td colSpan={6} style={{ padding: "1rem", textAlign: "center", opacity: 0.6 }}>No events found.</td></tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>{formatDate(row.created_at)}</td>
                <td style={{ padding: "5px 8px", fontFamily: "monospace", whiteSpace: "nowrap" }}>{row.action}</td>
                <td style={{ padding: "5px 8px", fontFamily: "monospace", fontSize: "0.75rem", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis" }}>{row.user_id ?? "—"}</td>
                <td style={{ padding: "5px 8px", fontFamily: "monospace", fontSize: "0.75rem", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis" }}>{row.actor_id ?? "—"}</td>
                <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>{row.ip_address ?? "—"}</td>
                <td style={{ padding: "5px 8px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.metadata ? JSON.stringify(row.metadata) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > LIMIT && (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", alignItems: "center" }}>
          <button className="button" disabled={offset === 0 || loading} onClick={() => void load(appliedFilters, Math.max(0, offset - LIMIT))}>Previous</button>
          <span className="subtitle">{offset + 1}–{Math.min(offset + LIMIT, total)} of {total}</span>
          <button className="button" disabled={offset + LIMIT >= total || loading} onClick={() => void load(appliedFilters, offset + LIMIT)}>Next</button>
        </div>
      )}
    </div>
  );
}
