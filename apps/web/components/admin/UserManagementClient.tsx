"use client";

import { useEffect, useState } from "react";

type AdminUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  planType: string;
  planStatus: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  verificationLevel: string;
  createdAt: string;
};

type Suspension = {
  id: string;
  reason: string;
  starts_at: string;
  ends_at: string | null;
};

type UserDetail = {
  user: AdminUser & { phone: string };
  suspension: Suspension | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function SuspendDialog({
  user,
  onClose,
  onDone,
}: {
  user: AdminUser;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { reason: reason.trim() };
      if (hours.trim()) body.hours = parseInt(hours, 10);
      const res = await fetch(`/api/admin/users/${user.id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to suspend user");
        return;
      }
      onDone();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass card" style={{ width: "min(90vw, 400px)" }}>
        <h2 className="title" style={{ fontSize: "1.1rem" }}>
          Suspend {user.firstName} {user.lastName}
        </h2>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div>
            <label className="subtitle" htmlFor="sus-reason">Reason *</label>
            <textarea
              id="sus-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              required
              style={{ width: "100%", resize: "vertical", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid var(--color-border, #333)" }}
            />
          </div>
          <div>
            <label className="subtitle" htmlFor="sus-hours">Duration (hours, blank = permanent)</label>
            <input
              id="sus-hours"
              type="number"
              min={1}
              max={8760}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid var(--color-border, #333)" }}
            />
          </div>
          {error && <p style={{ color: "var(--color-error, #e74c3c)", margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button type="button" className="button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="button" disabled={busy || !reason.trim()}>
              {busy ? "Suspending…" : "Suspend"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserDetailPanel({
  userId,
  onClose,
  onUpdated,
}: {
  userId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load user");
      setDetail(await res.json());
    } catch {
      setError("Failed to load user details");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [userId]);

  async function unsuspend() {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to unsuspend");
      await load();
      onUpdated();
    } catch {
      setError("Failed to unsuspend user");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass card" style={{ width: "min(90vw, 500px)", maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h2 className="title" style={{ fontSize: "1.1rem", margin: 0 }}>User detail</h2>
          <button className="button" onClick={onClose} style={{ padding: "0.25rem 0.5rem" }}>✕</button>
        </div>

        {loading && <p className="subtitle">Loading…</p>}
        {error && <p style={{ color: "var(--color-error, #e74c3c)" }}>{error}</p>}

        {detail && !loading && (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.75rem" }}>
              <tbody>
                {[
                  ["ID", detail.user.id],
                  ["Email", detail.user.email],
                  ["Name", `${detail.user.firstName} ${detail.user.lastName}`],
                  ["Phone", detail.user.phone || "—"],
                  ["Role", detail.user.role],
                  ["Plan", `${detail.user.planType} / ${detail.user.planStatus}`],
                  ["Email verified", detail.user.isEmailVerified ? "Yes" : "No"],
                  ["Phone verified", detail.user.isPhoneVerified ? "Yes" : "No"],
                  ["Verification", detail.user.verificationLevel],
                  ["Joined", formatDate(detail.user.createdAt)],
                ].map(([label, value]) => (
                  <tr key={label} style={{ borderBottom: "1px solid var(--color-border, #333)" }}>
                    <td style={{ padding: "0.4rem 0.5rem", fontWeight: 600, whiteSpace: "nowrap", opacity: 0.7, fontSize: "0.85rem" }}>{label}</td>
                    <td style={{ padding: "0.4rem 0.5rem", wordBreak: "break-all", fontSize: "0.85rem" }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: "1rem" }}>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem" }}>Suspension</h3>
              {detail.suspension ? (
                <div style={{ padding: "0.75rem", background: "var(--color-surface-2, rgba(231,76,60,0.1))", borderRadius: "0.375rem", marginBottom: "0.75rem" }}>
                  <p style={{ margin: 0, fontSize: "0.85rem" }}>
                    <strong>Reason:</strong> {detail.suspension.reason}
                  </p>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
                    <strong>Since:</strong> {formatDate(detail.suspension.starts_at)}
                    {detail.suspension.ends_at
                      ? ` · Until: ${formatDate(detail.suspension.ends_at)}`
                      : " · Permanent"}
                  </p>
                  <button
                    className="button"
                    style={{ marginTop: "0.5rem" }}
                    onClick={unsuspend}
                    disabled={busy}
                  >
                    {busy ? "Unsuspending…" : "Lift suspension"}
                  </button>
                </div>
              ) : (
                <p className="subtitle" style={{ marginBottom: "0.75rem" }}>Not suspended.</p>
              )}
              {!detail.suspension && (
                <button className="button" onClick={() => setShowSuspendDialog(true)}>
                  Suspend user
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {showSuspendDialog && detail && (
        <SuspendDialog
          user={detail.user}
          onClose={() => setShowSuspendDialog(false)}
          onDone={async () => {
            setShowSuspendDialog(false);
            await load();
            onUpdated();
          }}
        />
      )}
    </div>
  );
}

export function UserManagementClient() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkSuspending, setBulkSuspending] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);

  const limit = 20;

  async function load(q: string, off: number) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(off) });
      if (q.trim()) params.set("search", q.trim());
      const res = await fetch(`/api/admin/users?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
      setOffset(off);
    } catch {
      setError("Failed to load users. Check your admin access.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load("", 0); }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery(search);
    load(search, 0);
  }

  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (checkedIds.size === users.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(users.map((u) => u.id)));
    }
  }

  function exportCsv() {
    const selected = users.filter((u) => checkedIds.has(u.id));
    const rows = [
      ["ID", "Email", "First name", "Last name", "Role", "Plan type", "Plan status", "Email verified", "Phone verified", "Joined"],
      ...selected.map((u) => [u.id, u.email, u.firstName, u.lastName, u.role, u.planType, u.planStatus, String(u.isEmailVerified), String(u.isPhoneVerified), u.createdAt]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "users.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function bulkSuspend() {
    const reason = window.prompt("Suspension reason for all selected users:");
    if (!reason?.trim()) return;
    setBulkSuspending(true); setBulkNotice(null);
    const ids = [...checkedIds];
    let ok = 0;
    for (const id of ids) {
      try {
        await fetch(`/api/admin/users/${id}/suspend`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        });
        ok++;
      } catch { /* continue */ }
    }
    setBulkSuspending(false);
    setBulkNotice(`Suspended ${ok} of ${ids.length} users.`);
    setCheckedIds(new Set());
  }

  return (
    <div>
      <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          type="search"
          placeholder="Search by email or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, padding: "0.5rem 0.75rem",
            borderRadius: "0.375rem", border: "1px solid var(--color-border, #333)",
          }}
        />
        <button type="submit" className="button" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <p style={{ color: "var(--color-error, #e74c3c)" }}>{error}</p>}

      {!error && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <p className="subtitle" style={{ margin: 0 }}>
              {query ? `Results for "${query}" — ` : "All users — "}
              {total} total
            </p>
            {checkedIds.size > 0 && (
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span className="subtitle" style={{ margin: 0 }}>{checkedIds.size} selected</span>
                <button className="button" style={{ fontSize: "0.8rem", padding: "0.2rem 0.6rem" }} onClick={exportCsv}>Export CSV</button>
                <button className="button" style={{ fontSize: "0.8rem", padding: "0.2rem 0.6rem" }} onClick={() => void bulkSuspend()} disabled={bulkSuspending}>
                  {bulkSuspending ? "Suspending…" : "Suspend selected"}
                </button>
              </div>
            )}
          </div>
          {bulkNotice && <p style={{ fontSize: "0.85rem", color: "#22c55e", marginBottom: "0.5rem" }}>{bulkNotice}</p>}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--color-border, #333)" }}>
                  <th style={{ padding: "0.5rem", width: "2rem" }}>
                    <input type="checkbox" checked={users.length > 0 && checkedIds.size === users.length} onChange={toggleAll} />
                  </th>
                  {["Email", "Name", "Role", "Plan", "Verified", "Joined", ""].map((h) => (
                    <th key={h} style={{ padding: "0.5rem", textAlign: "left", whiteSpace: "nowrap", opacity: 0.7 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} style={{ padding: "1rem", textAlign: "center", opacity: 0.6 }}>
                      No users found.
                    </td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr
                    key={u.id}
                    style={{ borderBottom: "1px solid var(--color-border, #333)", background: checkedIds.has(u.id) ? "rgba(232, 193, 90,0.06)" : undefined }}
                  >
                    <td style={{ padding: "0.5rem" }}>
                      <input type="checkbox" checked={checkedIds.has(u.id)} onChange={() => toggleCheck(u.id)} />
                    </td>
                    <td style={{ padding: "0.5rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.email}
                    </td>
                    <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                      {u.firstName} {u.lastName}
                    </td>
                    <td style={{ padding: "0.5rem" }}>{u.role}</td>
                    <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                      {u.planType}/{u.planStatus}
                    </td>
                    <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                      {u.isEmailVerified ? "✓ Email" : "✗ Email"}
                      {" "}
                      {u.isPhoneVerified ? "✓ Phone" : ""}
                    </td>
                    <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                      {formatDate(u.createdAt)}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <button
                        className="button"
                        style={{ padding: "0.2rem 0.6rem", fontSize: "0.8rem" }}
                        onClick={() => setSelectedUserId(u.id)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > limit && (
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", alignItems: "center" }}>
              <button
                className="button"
                disabled={offset === 0 || loading}
                onClick={() => load(query, Math.max(0, offset - limit))}
              >
                Previous
              </button>
              <span className="subtitle">
                {offset + 1}–{Math.min(offset + limit, total)} of {total}
              </span>
              <button
                className="button"
                disabled={offset + limit >= total || loading}
                onClick={() => load(query, offset + limit)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {selectedUserId && (
        <UserDetailPanel
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onUpdated={() => load(query, offset)}
        />
      )}
    </div>
  );
}
