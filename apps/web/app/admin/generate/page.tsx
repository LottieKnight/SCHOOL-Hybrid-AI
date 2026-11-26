"use client";

import { useState } from "react";

type FormState = {
  phase: string;
  grade: string;
  subject: string;
  term: string;
  week: string;
  topic: string;
  force: boolean;
};

const PHASES = ["foundation", "intermediate", "senior", "fet"];

export default function AdminGeneratePage() {
  const [form, setForm] = useState<FormState>({
    phase: "foundation",
    grade: "1",
    subject: "",
    term: "1",
    week: "1",
    topic: "",
    force: false,
  });
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const updateField = (key: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value } as FormState));
  };

  const handleGenerateWeek = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/generate-lesson-v1", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: form.phase,
          grade: Number(form.grade),
          subject: form.subject,
          term: Number(form.term),
          week: Number(form.week),
          topic: form.topic || undefined,
          force: form.force,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Generation failed.");
      }
      setStatus(data?.skipped ? "Lesson already exists. Skipped." : "Lesson generated.");
    } catch (error: any) {
      setStatus(error?.message || "Generation failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTerm = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/generate-term-v1", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: form.phase,
          grade: Number(form.grade),
          subject: form.subject,
          term: Number(form.term),
          force: form.force,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Generation failed.");
      }
      setStatus("Term generation queued. Check the generated_lessons folder.");
    } catch (error: any) {
      setStatus(error?.message || "Generation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass card card-with-back">
      <h1 className="title">Generate lessons (v1)</h1>
      <p className="subtitle">
        Generate original CAPS-aligned lesson content and store it under{" "}
        <code>content/generated_lessons/v1</code>.
      </p>

      <div className="spacer" />
      <div className="list">
        <div className="list-item">
          <strong>Lesson parameters</strong>
          <div className="profile-form">
            <label className="profile-field">
              Phase
              <select value={form.phase} onChange={(event) => updateField("phase", event.target.value)}>
                {PHASES.map((phase) => (
                  <option key={phase} value={phase}>
                    {phase}
                  </option>
                ))}
              </select>
            </label>
            <label className="profile-field">
              Grade
              <input
                type="number"
                min="0"
                max="12"
                value={form.grade}
                onChange={(event) => updateField("grade", event.target.value)}
              />
            </label>
            <label className="profile-field">
              Subject key
              <input
                value={form.subject}
                onChange={(event) => updateField("subject", event.target.value)}
                placeholder="e.g. mathematics"
              />
            </label>
            <label className="profile-field">
              Term
              <input
                type="number"
                min="1"
                max="4"
                value={form.term}
                onChange={(event) => updateField("term", event.target.value)}
              />
            </label>
            <label className="profile-field">
              Week
              <input
                type="number"
                min="1"
                max="52"
                value={form.week}
                onChange={(event) => updateField("week", event.target.value)}
              />
            </label>
            <label className="profile-field">
              Topic (optional)
              <input value={form.topic} onChange={(event) => updateField("topic", event.target.value)} />
            </label>
            <label className="profile-field">
              Force regenerate
              <input
                type="checkbox"
                checked={form.force}
                onChange={(event) => updateField("force", event.target.checked)}
              />
            </label>
          </div>

          <div className="outline-actions" style={{ marginTop: "1rem" }}>
            <button className="button" type="button" onClick={handleGenerateWeek} disabled={loading}>
              {loading ? "Working..." : "Generate week"}
            </button>
            <button className="button" type="button" onClick={handleGenerateTerm} disabled={loading}>
              {loading ? "Working..." : "Generate term"}
            </button>
          </div>
          {status ? <p className="badge">{status}</p> : null}
        </div>
      </div>
    </div>
  );
}
