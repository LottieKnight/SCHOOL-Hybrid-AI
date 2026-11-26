"use client";

import { useEffect, useState } from "react";
import { AdminQuickLinks } from "@/components/AdminQuickLinks";

type FeatureFlag = {
  flag_key: string;
  description: string | null;
  enabled: boolean;
  rollout_percent: number;
  kill_switch: boolean;
  allow_roles: string[];
  updated_at: string;
};

function FlagRow({ flag, onUpdated }: { flag: FeatureFlag; onUpdated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(patch: Partial<{ enabled: boolean; killSwitch: boolean; rolloutPercent: number }>) {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/admin/feature-flags/${encodeURIComponent(flag.flag_key)}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed"); return; }
      onUpdated();
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  }

  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}>
      <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: "0.85rem", fontWeight: 600 }}>{flag.flag_key}</td>
      <td style={{ padding: "10px 8px", fontSize: "0.8rem", color: "var(--text-3)", maxWidth: "200px" }}>{flag.description ?? "—"}</td>
      <td style={{ padding: "10px 8px" }}>
        <button
          onClick={() => void patch({ enabled: !flag.enabled })}
          disabled={saving || flag.kill_switch}
          style={{
            padding: "3px 10px", borderRadius: "999px", border: "none", cursor: flag.kill_switch ? "not-allowed" : "pointer",
            fontSize: "0.78rem", fontWeight: 600,
            background: flag.enabled ? "#22c55e" : "var(--bg-2)",
            color: flag.enabled ? "#fff" : "var(--text-3)",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {flag.enabled ? "On" : "Off"}
        </button>
      </td>
      <td style={{ padding: "10px 8px", fontSize: "0.8rem" }}>{flag.rollout_percent}%</td>
      <td style={{ padding: "10px 8px" }}>
        <button
          onClick={() => void patch({ killSwitch: !flag.kill_switch })}
          disabled={saving}
          style={{
            padding: "3px 10px", borderRadius: "999px", border: "none", cursor: "pointer",
            fontSize: "0.78rem", fontWeight: 600,
            background: flag.kill_switch ? "#ef4444" : "var(--bg-2)",
            color: flag.kill_switch ? "#fff" : "var(--text-3)",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {flag.kill_switch ? "KILLED" : "Active"}
        </button>
      </td>
      <td style={{ padding: "10px 8px", fontSize: "0.78rem", color: "var(--text-3)", whiteSpace: "nowrap" }}>
        {flag.allow_roles.length > 0 ? flag.allow_roles.join(", ") : "All"}
      </td>
      {error && <td style={{ padding: "10px 8px", color: "#ef4444", fontSize: "0.78rem" }}>{error}</td>}
    </tr>
  );
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/feature-flags", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setFlags(data.flags ?? []);
    } catch { setError("Failed to load feature flags."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="glass card card-with-back">
      <h1 className="title">Feature flags</h1>
      <p className="subtitle">Toggle platform features and rollout percentages.</p>
      <AdminQuickLinks />
      <div className="spacer" />

      {loading && <p className="subtitle">Loading…</p>}
      {error && <p style={{ color: "#ef4444" }}>{error}</p>}

      {!loading && flags.length === 0 && !error && (
        <p className="subtitle">No feature flags configured.</p>
      )}

      {flags.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                {["Flag key", "Description", "Enabled", "Rollout", "Kill switch", "Roles"].map((h) => (
                  <th key={h} style={{ padding: "6px 8px", textAlign: "left", opacity: 0.7, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <FlagRow key={flag.flag_key} flag={flag} onUpdated={load} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
