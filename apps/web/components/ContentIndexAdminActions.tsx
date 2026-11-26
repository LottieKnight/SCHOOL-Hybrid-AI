"use client";

import { useState } from "react";

type Summary = {
  total_week_folders: number;
  weeks_with_json: number;
  weeks_with_resources_only: number;
  phases: number;
  grades: number;
  subjects: number;
};

export function ContentIndexAdminActions({ initialSummary }: { initialSummary: Summary }) {
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegenerate() {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/content-index/regenerate", {
        method: "POST",
      });
      if (!response.ok) {
        setStatus("Failed to regenerate index.");
        return;
      }
      const data = await response.json();
      if (data?.summary) {
        setSummary(data.summary);
        setStatus("Content index regenerated.");
      } else {
        setStatus("Content index regenerated, but no summary returned.");
      }
    } catch {
      setStatus("Failed to regenerate index.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="outline-actions">
        <button type="button" className="button" onClick={handleRegenerate} disabled={loading}>
          {loading ? "Regenerating..." : "Regenerate content index"}
        </button>
        {status ? <span className="badge">{status}</span> : null}
      </div>

      <div className="spacer" />
      <div className="grid">
        <div className="list-item">
          <strong>Total week folders</strong>
          <div className="badge">{summary.total_week_folders}</div>
        </div>
        <div className="list-item">
          <strong>Weeks with JSON</strong>
          <div className="badge">{summary.weeks_with_json}</div>
        </div>
        <div className="list-item">
          <strong>Resources only</strong>
          <div className="badge">{summary.weeks_with_resources_only}</div>
        </div>
        <div className="list-item">
          <strong>Phases</strong>
          <div className="badge">{summary.phases}</div>
        </div>
        <div className="list-item">
          <strong>Grades</strong>
          <div className="badge">{summary.grades}</div>
        </div>
        <div className="list-item">
          <strong>Subjects</strong>
          <div className="badge">{summary.subjects}</div>
        </div>
      </div>
    </div>
  );
}
