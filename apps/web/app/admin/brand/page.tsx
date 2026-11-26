// DEPRECATED: Moved to deprecated/ branch.
// Safe to delete after 2026-06-01.
"use client";

import { useState, useEffect, type FormEvent } from "react";
import { API_BASE } from "@/lib/apiBase";

type Draft = {
  id: number;
  signal_id: number;
  platform: string;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  source: string;
  pillar: string;
  raw_content: string;
  created_at: string;
};

type WeeklyRow = {
  platform: string;
  posts: string;
  total_impressions: string;
  total_engagements: string;
  avg_engagement_rate: string | null;
};

type VoiceModel = {
  id: number;
  version: number;
  system_prompt: string;
  examples: unknown[];
  active: boolean;
};

export default function AdminBrandPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [weekly, setWeekly] = useState<WeeklyRow[]>([]);
  const [voiceModel, setVoiceModel] = useState<VoiceModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [signalForm, setSignalForm] = useState({
    content: "",
    pillar: "trading" as "trading" | "school" | "aura" | "builder",
  });
  const [voiceForm, setVoiceForm] = useState({ systemPrompt: "" });
  const [status, setStatus] = useState<string | null>(null);

  const load = async () => {
    try {
      const [dRes, aRes, vRes] = await Promise.all([
        fetch(`${API_BASE}/brand/drafts`, { credentials: "include" }),
        fetch(`${API_BASE}/brand/analytics`, { credentials: "include" }),
        fetch(`${API_BASE}/brand/voice-model`, { credentials: "include" }),
      ]);
      if (dRes.ok) {
        const d = await dRes.json();
        setDrafts(d.drafts ?? []);
      }
      if (aRes.ok) {
        const a = await aRes.json();
        setWeekly(a.weekly ?? []);
      }
      if (vRes.ok) {
        const v = await vRes.json();
        setVoiceModel(v.voiceModel ?? null);
        if (v.voiceModel?.system_prompt) {
          setVoiceForm((prev) => ({
            ...prev,
            systemPrompt: v.voiceModel.system_prompt,
          }));
        }
      }
    } catch {
      setStatus("Failed to load BrandOS data. Is the API running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmitSignal = async (e: FormEvent) => {
    e.preventDefault();
    setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/brand/signal`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "manual",
          rawContent: signalForm.content,
          pillar: signalForm.pillar,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data?.error ?? "Failed to queue signal");
        return;
      }
      setStatus("Signal queued.");
      setSignalForm((prev) => ({ ...prev, content: "" }));
      load();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Request failed");
    }
  };

  const handleSaveVoice = async (e: FormEvent) => {
    e.preventDefault();
    setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/brand/voice-model`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: voiceForm.systemPrompt,
          examples: [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data?.error ?? "Failed to save voice model");
        return;
      }
      setStatus("Voice model saved.");
      load();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Request failed");
    }
  };

  if (loading) {
    return (
      <div className="glass card card-with-back">
        <h1 className="title">BrandOS</h1>
        <p className="subtitle">Loading…</p>
      </div>
    );
  }

  return (
    <div className="glass card card-with-back">
      <h1 className="title">BrandOS</h1>
      <p className="subtitle">
        Autonomous personal brand: drafts, analytics, voice model, manual signals.
      </p>

      {status && (
        <div className="outline-actions" style={{ marginBottom: "1rem" }}>
          <span style={{ color: "var(--text)" }}>{status}</span>
        </div>
      )}

      <section style={{ marginBottom: "2rem" }}>
        <h2 className="subtitle">Manual signal</h2>
        <form onSubmit={handleSubmitSignal}>
          <div style={{ marginBottom: "0.5rem" }}>
            <label>
              Pillar:{" "}
              <select
                value={signalForm.pillar}
                onChange={(e) =>
                  setSignalForm((prev) => ({
                    ...prev,
                    pillar: e.target.value as typeof prev.pillar,
                  }))
                }
              >
                <option value="trading">trading</option>
                <option value="school">school</option>
                <option value="aura">aura</option>
                <option value="builder">builder</option>
              </select>
            </label>
          </div>
          <textarea
            value={signalForm.content}
            onChange={(e) =>
              setSignalForm((prev) => ({ ...prev, content: e.target.value }))
            }
            placeholder="Raw content or idea…"
            rows={3}
            style={{ width: "100%", marginBottom: "0.5rem" }}
          />
          <button type="submit" className="button">
            Queue signal
          </button>
        </form>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 className="subtitle">Voice model</h2>
        {voiceModel ? (
          <p style={{ marginBottom: "0.5rem" }}>
            Active version: {voiceModel.version}
          </p>
        ) : (
          <p style={{ marginBottom: "0.5rem" }}>
            No active voice model. Create one below.
          </p>
        )}
        <form onSubmit={handleSaveVoice}>
          <textarea
            value={voiceForm.systemPrompt}
            onChange={(e) =>
              setVoiceForm((prev) => ({ ...prev, systemPrompt: e.target.value }))
            }
            placeholder="System prompt for content generation…"
            rows={6}
            style={{ width: "100%", marginBottom: "0.5rem" }}
          />
          <button type="submit" className="button">
            Save voice model
          </button>
        </form>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 className="subtitle">Weekly analytics</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "0.25rem" }}>Platform</th>
              <th style={{ textAlign: "right", padding: "0.25rem" }}>Posts</th>
              <th style={{ textAlign: "right", padding: "0.25rem" }}>Impressions</th>
              <th style={{ textAlign: "right", padding: "0.25rem" }}>Engagements</th>
              <th style={{ textAlign: "right", padding: "0.25rem" }}>Eng. rate %</th>
            </tr>
          </thead>
          <tbody>
            {weekly.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "0.5rem" }}>
                  No data for the last 7 days.
                </td>
              </tr>
            ) : (
              weekly.map((row) => (
                <tr key={row.platform}>
                  <td style={{ padding: "0.25rem" }}>{row.platform}</td>
                  <td style={{ textAlign: "right", padding: "0.25rem" }}>{row.posts}</td>
                  <td style={{ textAlign: "right", padding: "0.25rem" }}>
                    {row.total_impressions}
                  </td>
                  <td style={{ textAlign: "right", padding: "0.25rem" }}>
                    {row.total_engagements}
                  </td>
                  <td style={{ textAlign: "right", padding: "0.25rem" }}>
                    {row.avg_engagement_rate ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="subtitle">Recent drafts</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "0.25rem" }}>Platform</th>
              <th style={{ textAlign: "left", padding: "0.25rem" }}>Pillar</th>
              <th style={{ textAlign: "left", padding: "0.25rem" }}>Status</th>
              <th style={{ textAlign: "left", padding: "0.25rem" }}>Scheduled</th>
              <th style={{ textAlign: "left", padding: "0.25rem" }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {drafts.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "0.5rem" }}>
                  No drafts yet.
                </td>
              </tr>
            ) : (
              drafts.slice(0, 20).map((d) => (
                <tr key={d.id}>
                  <td style={{ padding: "0.25rem" }}>{d.platform}</td>
                  <td style={{ padding: "0.25rem" }}>{d.pillar}</td>
                  <td style={{ padding: "0.25rem" }}>{d.status}</td>
                  <td style={{ padding: "0.25rem" }}>
                    {d.scheduled_at
                      ? new Date(d.scheduled_at).toLocaleString()
                      : "—"}
                  </td>
                  <td style={{ padding: "0.25rem" }}>
                    {new Date(d.created_at).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
