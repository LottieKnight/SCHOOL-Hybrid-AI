"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { StateCard } from "@/components/ui/StateCard";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";

type Artifact = {
  id: string;
  title: string;
  body: string;
  artifactType: string;
  status: "saved" | "archived";
  sourceType?: string | null;
  sourceId?: string | null;
  evidence: Array<{ type?: string; label?: string }>;
  createdAt: string;
  updatedAt: string;
};

export default function RevisionHistoryClient() {
  const { session } = useSession();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [filter, setFilter] = useState<"saved" | "archived">("saved");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadArtifacts = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError(null); setNotice(null);
    try {
      const response = await fetch(`${API_BASE}/learning/revision-artifacts?status=${filter}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Unable to load revision history.");
      setArtifacts((payload?.artifacts || []) as Artifact[]);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Unable to load revision history."));
    } finally { setLoading(false); }
  }, [filter, session]);

  useEffect(() => { if (!session) { setLoading(false); return; } void loadArtifacts(); }, [loadArtifacts, session]);

  const grouped = useMemo(() => artifacts.reduce<Record<string, Artifact[]>>((groups, artifact) => {
    const label = formatMonth(artifact.createdAt);
    (groups[label] ||= []).push(artifact);
    return groups;
  }, {}), [artifacts]);

  const changeStatus = async (artifact: Artifact, status: "saved" | "archived") => {
    setNotice(null);
    const response = await fetch(`${API_BASE}/learning/revision-artifacts/${artifact.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!response.ok) { setError("Unable to update this revision artifact."); return; }
    setArtifacts((current) => current.filter((item) => item.id !== artifact.id));
    setNotice(status === "archived" ? "Revision artifact archived." : "Revision artifact restored.");
  };

  const removeArtifact = async (artifact: Artifact) => {
    if (!window.confirm("Delete this revision artifact? This cannot be undone.")) return;
    const response = await fetch(`${API_BASE}/learning/revision-artifacts/${artifact.id}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) { setError("Unable to delete this revision artifact."); return; }
    setArtifacts((current) => current.filter((item) => item.id !== artifact.id));
    setNotice("Revision artifact deleted.");
  };

  if (!session) return <StateCard title="Your revision history" description="Sign in to revisit the progress you have made across SCHOOL." />;

  return (
    <div className="glass card card-with-back revision-history-page">
      <RouteHeader eyebrow="Progress / Revision" title="Your revision history" description="The learning moments worth carrying forward: what changed, why it changed, and what to do next." size={76}>
        <div className="outline-actions"><Link className="button button--ghost" href="/dashboard/progress" prefetch={false}>Back to progress</Link><button type="button" onClick={() => void loadArtifacts()} disabled={loading}>{loading ? "Refreshing…" : "Refresh history"}</button></div>
      </RouteHeader>
      <div className="revision-history-toolbar" role="tablist" aria-label="Revision artifact status">
        {(["saved", "archived"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={filter === value} className={filter === value ? "is-active" : ""} onClick={() => setFilter(value)}>{value === "saved" ? "Saved" : "Archived"}</button>)}
      </div>
      {notice ? <p className="targeted-retry-status" role="status">{notice}</p> : null}
      {error ? <StateCard tone="danger" title="Revision history unavailable" description={error}><button type="button" onClick={() => void loadArtifacts()}>Try again</button></StateCard> : null}
      {loading ? <StateCard title="Reading your revision history" description="SCHOOL is gathering your saved learning artifacts." /> : null}
      {!loading && !error && artifacts.length === 0 ? <StateCard tone="success" title={filter === "saved" ? "Nothing saved yet" : "No archived artifacts"} description={filter === "saved" ? "Complete a targeted retry and save its session summary to start building your personal revision history." : "Archived artifacts will stay out of your active revision view."}><Link className="button" href="/past-papers" prefetch={false}>Find a past paper</Link></StateCard> : null}
      {!loading && !error && artifacts.length > 0 ? <div className="revision-history-list">{Object.entries(grouped).map(([month, items]) => <section key={month}><div className="revision-history-month">{month}</div><div className="revision-artifact-grid">{items.map((artifact) => <ArtifactCard key={artifact.id} artifact={artifact} onArchive={() => void changeStatus(artifact, "archived")} onRestore={() => void changeStatus(artifact, "saved")} onDelete={() => void removeArtifact(artifact)} />)}</div></section>)}</div> : null}
    </div>
  );
}

function ArtifactCard({ artifact, onArchive, onRestore, onDelete }: { artifact: Artifact; onArchive: () => void; onRestore: () => void; onDelete: () => void }) {
  const lines = artifact.body.split("\n").filter(Boolean);
  return <article className="revision-artifact-card"><div className="revision-artifact-card__top"><span className="eyebrow">{formatKind(artifact.artifactType)}</span><time dateTime={artifact.createdAt}>{formatDate(artifact.createdAt)}</time></div><h3><Link href={`/dashboard/revision/${artifact.id}`} prefetch={false}>{artifact.title}</Link></h3><ul>{lines.slice(0, 4).map((line) => <li key={line}>{line.replace(/^•\s*/, "")}</li>)}</ul>{artifact.evidence.length ? <div className="revision-artifact-evidence">{artifact.evidence.map((item, index) => <span key={`${item.label}-${index}`}>{item.label || item.type || "Evidence"}</span>)}</div> : null}<div className="outline-actions"><Link className="button button--ghost" href={`/dashboard/revision/${artifact.id}`} prefetch={false}>Open</Link>{artifact.status === "saved" ? <button type="button" className="button button--ghost" onClick={onArchive}>Archive</button> : <button type="button" className="button button--ghost" onClick={onRestore}>Restore</button>}<button type="button" className="button button--ghost" onClick={onDelete}>Delete</button></div></article>;
}

function formatKind(value: string) { return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
function formatMonth(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Earlier" : date.toLocaleDateString(undefined, { month: "long", year: "numeric" }); }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
