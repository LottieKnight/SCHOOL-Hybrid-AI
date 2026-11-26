"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type Circle = {
  id: string;
  name: string;
  module_code: string | null;
  description: string | null;
  member_count: string;
  invite_code: string;
  is_member?: boolean;
};

type Tab = "mine" | "discover";

export default function StudyCirclesPage() {
  const [tab, setTab] = useState<Tab>("mine");
  const [myCircles, setMyCircles] = useState<Circle[]>([]);
  const [publicCircles, setPublicCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", moduleCode: "", isPublic: true });
  const [notice, setNotice] = useState<string | null>(null);

  const loadMine = useCallback(async () => {
    const res = await fetch("/api/community/circles", { credentials: "include" });
    const data = (await res.json()) as { circles: Circle[] };
    setMyCircles(data.circles ?? []);
  }, []);

  const loadPublic = useCallback(async () => {
    const res = await fetch("/api/community/circles?discover=true", { credentials: "include" });
    const data = (await res.json()) as { circles: Circle[] };
    setPublicCircles(data.circles ?? []);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadMine(), loadPublic()]).finally(() => setLoading(false));
  }, [loadMine, loadPublic]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    setNotice(null);
    try {
      const res = await fetch("/api/community/circles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setNotice(err.error ?? "Failed to create circle.");
        return;
      }
      setForm({ name: "", description: "", moduleCode: "", isPublic: true });
      setShowCreate(false);
      await Promise.all([loadMine(), loadPublic()]);
      setTab("mine");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (circleId: string) => {
    const res = await fetch(`/api/community/circles/${circleId}/join`, {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) {
      await Promise.all([loadMine(), loadPublic()]);
      setTab("mine");
    } else {
      const err = (await res.json()) as { error?: string };
      setNotice(err.error ?? "Could not join circle.");
    }
  };

  return (
    <div className="route-lock-dock">
      <div className="route-lock-frame glass card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>Study Circles</h1>
          <button className="button" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Cancel" : "+ Create Circle"}
          </button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} style={{ display: "grid", gap: 10, marginBottom: 20, padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.5)", border: "1px solid rgba(54,45,30,0.1)" }}>
            <input
              className="input"
              placeholder="Circle name (e.g. ECON211 Grind)"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              maxLength={80}
              required
            />
            <input
              className="input"
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              maxLength={200}
            />
            <input
              className="input"
              placeholder="Module code (e.g. ECON211)"
              value={form.moduleCode}
              onChange={(e) => setForm((f) => ({ ...f, moduleCode: e.target.value }))}
              maxLength={20}
            />
            <label style={{ fontSize: "0.85rem", display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={(e) => setForm((f) => ({ ...f, isPublic: e.target.checked }))}
              />
              Public circle (visible in Discover)
            </label>
            {notice && <p style={{ margin: 0, color: "var(--red, #dc2626)", fontSize: "0.82rem" }}>{notice}</p>}
            <button className="button" type="submit" disabled={creating}>
              {creating ? "Creating…" : "Create Circle"}
            </button>
          </form>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["mine", "discover"] as Tab[]).map((t) => (
            <button
              key={t}
              className="button"
              style={{ opacity: tab === t ? 1 : 0.55 }}
              onClick={() => setTab(t)}
            >
              {t === "mine" ? "My Circles" : "Discover"}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Loading…</p>
        ) : tab === "mine" ? (
          myCircles.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", textAlign: "center", padding: "32px 0" }}>
              You haven't joined any circles yet. Try Discover to find one.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {myCircles.map((c) => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.5)", border: "1px solid rgba(54,45,30,0.1)", gap: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem" }}>{c.name}</p>
                    <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted)" }}>
                      {c.member_count} members{c.module_code ? ` · ${c.module_code}` : ""}
                    </p>
                  </div>
                  <Link className="button" href={`/community/circles/${c.id}`} style={{ fontSize: "0.82rem", padding: "5px 12px" }}>
                    Open
                  </Link>
                </div>
              ))}
            </div>
          )
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {publicCircles.length === 0 && (
              <p style={{ color: "var(--muted)", fontSize: "0.85rem", textAlign: "center", padding: "32px 0" }}>
                No public circles yet. Create the first one!
              </p>
            )}
            {publicCircles.map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.5)", border: "1px solid rgba(54,45,30,0.1)", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem" }}>{c.name}</p>
                  {c.description && <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>{c.description}</p>}
                  <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                    {c.member_count} members{c.module_code ? ` · ${c.module_code}` : ""}
                  </p>
                </div>
                {c.is_member ? (
                  <Link className="button" href={`/community/circles/${c.id}`} style={{ fontSize: "0.82rem", padding: "5px 12px" }}>
                    Open
                  </Link>
                ) : (
                  <button className="button" style={{ fontSize: "0.82rem", padding: "5px 12px" }} onClick={() => handleJoin(c.id)}>
                    Join
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
