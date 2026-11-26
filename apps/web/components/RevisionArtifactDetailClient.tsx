"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { StateCard } from "@/components/ui/StateCard";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";

type PlannerStatus = "scheduled" | "completed" | "skipped";
type Artifact = { id: string; title: string; body: string; artifactType: string; status: "saved" | "archived"; plannerStatus?: PlannerStatus | null; plannerEventId?: string | null; plannerCompletedAt?: string | null; plannerSkippedAt?: string | null; sourceType?: string | null; sourceId?: string | null; evidence: Array<{ type?: string; label?: string }>; createdAt: string; updatedAt: string };

export default function RevisionArtifactDetailClient() {
  const { session } = useSession();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState(() => {
    const date = new Date(); date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  });
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);

  const load = useCallback(async () => {
    if (!session || !params?.id) return;
    setLoading(true); setError(null);
    try {
      const response = await fetch(`${API_BASE}/learning/revision-artifacts/${encodeURIComponent(params.id)}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Unable to load revision artifact.");
      setArtifact(payload.artifact as Artifact);
      setScheduled(payload.artifact?.plannerStatus === "scheduled");
    } catch (cause) { setError(getApiErrorMessage(cause, "Unable to load revision artifact.")); }
    finally { setLoading(false); }
  }, [params, session]);

  useEffect(() => { void load(); }, [load]);

  const updateStatus = async (status: "saved" | "archived") => {
    if (!artifact) return;
    const response = await fetch(`${API_BASE}/learning/revision-artifacts/${artifact.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!response.ok) { setError("Unable to update this artifact."); return; }
    setArtifact((current) => current ? { ...current, status } : current);
  };

  const remove = async () => {
    if (!artifact || !window.confirm("Delete this revision artifact? This cannot be undone.")) return;
    const response = await fetch(`${API_BASE}/learning/revision-artifacts/${artifact.id}`, { method: "DELETE", credentials: "include" });
    if (response.ok) router.push("/dashboard/revision"); else setError("Unable to delete this artifact.");
  };

  const scheduleStudyTask = async () => {
    if (!artifact || !scheduleDate) return;
    setScheduling(true); setScheduleNotice(null); setError(null);
    try {
      const response = await fetch(`${API_BASE}/learning/revision-artifacts/${artifact.id}/schedule`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventDate: scheduleDate }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Unable to schedule this study task.");
      if (payload?.event?.id) setArtifact((current) => current ? { ...current, plannerStatus: "scheduled", plannerEventId: String(payload.event.id), plannerCompletedAt: null, plannerSkippedAt: null } : current);
      setScheduled(true);
      setScheduleNotice(payload?.alreadyScheduled ? "This revision is already on your planner." : `Study task scheduled for ${formatDate(scheduleDate)}.`);
    } catch (cause) { setScheduleNotice(getApiErrorMessage(cause, "Unable to schedule this study task.")); }
    finally { setScheduling(false); }
  };

  const updatePlannerStatus = async (status: PlannerStatus) => {
    if (!artifact) return;
    setLifecycleBusy(true); setScheduleNotice(null);
    try {
      const response = await fetch(`${API_BASE}/learning/revision-artifacts/${artifact.id}/schedule`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Unable to update the study task.");
      setArtifact(payload.artifact as Artifact);
      setScheduled(status === "scheduled");
      setScheduleNotice(status === "completed" ? "Marked complete — your recovery work is logged." : status === "skipped" ? "Skipped for now. You can schedule it again when ready." : "Study task returned to your planner.");
    } catch (cause) { setScheduleNotice(getApiErrorMessage(cause, "Unable to update the study task.")); }
    finally { setLifecycleBusy(false); }
  };

  if (!session) return <StateCard title="Revision artifact" description="Sign in to view this saved learning moment." />;
  if (loading) return <StateCard title="Loading revision artifact" description="SCHOOL is retrieving the evidence and next action." />;
  if (error || !artifact) return <StateCard tone="danger" title="Artifact unavailable" description={error || "This revision artifact could not be found."}><Link className="button" href="/dashboard/revision" prefetch={false}>Back to revision history</Link></StateCard>;

  return <div className="glass card card-with-back revision-detail-page"><RouteHeader eyebrow="Progress / Revision artifact" title={artifact.title} description="A durable record of what changed and what to carry into your next study session." size={76}><div className="outline-actions"><Link className="button button--ghost" href="/dashboard/revision" prefetch={false}>Back to history</Link>{artifact.status === "saved" ? <button type="button" onClick={() => void updateStatus("archived")}>Archive</button> : <button type="button" onClick={() => void updateStatus("saved")}>Restore</button>}<button type="button" className="button button--ghost" onClick={() => void remove()}>Delete</button></div></RouteHeader><div className="revision-detail-meta"><span className="badge">{formatKind(artifact.artifactType)}</span><time dateTime={artifact.createdAt}>{formatDate(artifact.createdAt)}</time>{artifact.sourceType ? <span>Source: {formatKind(artifact.sourceType)}</span> : null}{artifact.plannerStatus ? <span className={`revision-planner-status revision-planner-status--${artifact.plannerStatus}`}>{formatKind(artifact.plannerStatus)}</span> : null}</div><article className="revision-detail-body">{artifact.body.split("\n").map((line, index) => line ? <p key={`${line}-${index}`}>{line.replace(/^•\s*/, "")}</p> : <br key={`break-${index}`} />)}</article><section className="revision-schedule-card"><div><span className="session-summary__label">Next learning action</span><h3>{artifact.plannerStatus === "completed" ? "Recovery work completed" : artifact.plannerStatus === "skipped" ? "Recovery work paused" : "Put this recovery work on your planner"}</h3><p>{artifact.plannerStatus === "completed" ? "This task is complete and the result is now part of your learning record." : artifact.plannerStatus === "skipped" ? "Bring it back when you are ready to continue this recovery loop." : "Choose a day and SCHOOL will create a personal study task linked to this evidence."}</p></div><div className="revision-schedule-controls">{artifact.plannerStatus !== "scheduled" ? <><label htmlFor="revision-study-date">Study date</label><input id="revision-study-date" type="date" value={scheduleDate} onChange={(event) => { setScheduleDate(event.target.value); setScheduled(false); setScheduleNotice(null); }} /><button type="button" onClick={() => void scheduleStudyTask()} disabled={scheduling || scheduled}>{scheduling ? "Scheduling…" : "Schedule study task"}</button></> : <><button type="button" onClick={() => void updatePlannerStatus("completed")} disabled={lifecycleBusy}>{lifecycleBusy ? "Saving…" : "Mark complete"}</button><button type="button" className="button button--ghost" onClick={() => void updatePlannerStatus("skipped")} disabled={lifecycleBusy}>Skip for now</button></>}</div>{scheduleNotice ? <p className="targeted-retry-status" role="status">{scheduleNotice}</p> : null}</section>{artifact.evidence.length ? <section className="revision-detail-evidence"><span className="session-summary__label">Evidence captured</span><div>{artifact.evidence.map((item, index) => <span key={`${item.label}-${index}`}>{item.label || item.type || "Evidence"}</span>)}</div></section> : null}</div>;
}

function formatKind(value: string) { return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }); }
