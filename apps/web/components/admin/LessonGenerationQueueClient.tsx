"use client";

import { useEffect, useMemo, useState } from "react";

type QueueStatus = "QUEUED" | "RUNNING" | "DONE" | "FAILED";

type QueueJob = {
  id: string;
  request: {
    phase?: string;
    grade?: number;
    subjectKey?: string;
    term?: number;
    week?: number;
    source?: string;
    force?: boolean;
  };
  status: QueueStatus;
  error: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
};

const STATUS_LABELS: Record<QueueStatus, string> = {
  QUEUED: "Queued",
  RUNNING: "Processing",
  DONE: "Completed",
  FAILED: "Failed",
};

function sortJobs(items: QueueJob[]) {
  return [...items].sort(
    (left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function LessonGenerationQueueClient() {
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/lesson-generation-queue?limit=100", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load queue");
      }
      setJobs(Array.isArray(data?.jobs) ? sortJobs(data.jobs) : []);
      setStatus(null);
    } catch (error: any) {
      setStatus(error?.message || "Failed to load queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadJobs();
    const interval = window.setInterval(() => {
      void loadJobs();
    }, 15000);
    return () => window.clearInterval(interval);
  }, []);

  const counts = useMemo(() => {
    return jobs.reduce(
      (acc, job) => {
        acc.total += 1;
        acc[job.status] += 1;
        return acc;
      },
      { total: 0, QUEUED: 0, RUNNING: 0, DONE: 0, FAILED: 0 }
    );
  }, [jobs]);

  const transitionJob = async (jobId: string, action: "processing" | "completed" | "failed" | "retry") => {
    setBusyJobId(jobId);
    setStatus(null);
    try {
      const payload: Record<string, string> = { action };
      if (action === "failed") {
        const error = window.prompt("Failure reason", "Manual admin failure mark")?.trim();
        if (!error) {
          setBusyJobId(null);
          return;
        }
        payload.error = error;
      }

      const response = await fetch(`/api/admin/lesson-generation-queue/${jobId}/transition`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Transition failed");
      }

      setJobs((current) => sortJobs(current.map((job) => (job.id === jobId ? data.job : job))));
      setStatus(`Job updated: ${action}`);
    } catch (error: any) {
      setStatus(error?.message || "Transition failed");
    } finally {
      setBusyJobId(null);
    }
  };

  return (
    <div className="glass card card-with-back">
      <h1 className="title">Lesson generation queue</h1>
      <p className="subtitle">Review queued lesson jobs and manually move them through processing, completion, failure, and retry states. The list auto-refreshes every 15 seconds.</p>

      <div className="outline-actions" style={{ marginTop: "1rem", flexWrap: "wrap" }}>
        <span className="badge">Total {counts.total}</span>
        <span className="badge">Queued {counts.QUEUED}</span>
        <span className="badge">Processing {counts.RUNNING}</span>
        <span className="badge">Completed {counts.DONE}</span>
        <span className="badge">Failed {counts.FAILED}</span>
        <button className="button" type="button" onClick={loadJobs} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {status ? <p className="badge" style={{ marginTop: "1rem" }}>{status}</p> : null}

      <div className="list" style={{ marginTop: "1rem" }}>
        {jobs.map((job) => {
          const requestLabel = [job.request.phase, job.request.grade ? `G${job.request.grade}` : null, job.request.subjectKey, job.request.term ? `T${job.request.term}` : null, job.request.week ? `W${job.request.week}` : null]
            .filter(Boolean)
            .join(" • ");

          return (
            <div key={job.id} className="list-item">
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                <div>
                  <strong>{requestLabel || job.id}</strong>
                  <p className="subtitle">{job.request.source || "lesson generation"}</p>
                </div>
                <span className="badge">{STATUS_LABELS[job.status]}</span>
              </div>

              <div className="grid" style={{ marginTop: "0.75rem" }}>
                <div className="badge">Created {formatDate(job.created_at)}</div>
                <div className="badge">Updated {formatDate(job.updated_at)}</div>
                <div className="badge">Started {formatDate(job.started_at)}</div>
                <div className="badge">Completed {formatDate(job.completed_at)}</div>
                <div className="badge">Failed {formatDate(job.failed_at)}</div>
              </div>

              {job.last_error ? <p className="subtitle" style={{ marginTop: "0.75rem" }}>Last error: {job.last_error}</p> : null}

              <div className="outline-actions" style={{ marginTop: "0.75rem", flexWrap: "wrap" }}>
                <button className="button" type="button" disabled={busyJobId === job.id || job.status !== "QUEUED"} onClick={() => transitionJob(job.id, "processing")}>Mark processing</button>
                <button className="button" type="button" disabled={busyJobId === job.id || job.status !== "RUNNING"} onClick={() => transitionJob(job.id, "completed")}>Mark completed</button>
                <button className="button" type="button" disabled={busyJobId === job.id || job.status !== "RUNNING"} onClick={() => transitionJob(job.id, "failed")}>Mark failed</button>
                <button className="button" type="button" disabled={busyJobId === job.id || job.status !== "FAILED"} onClick={() => transitionJob(job.id, "retry")}>Retry</button>
              </div>
            </div>
          );
        })}

        {!loading && jobs.length === 0 ? <div className="list-item"><p className="subtitle">No jobs in the queue yet.</p></div> : null}
      </div>
    </div>
  );
}
