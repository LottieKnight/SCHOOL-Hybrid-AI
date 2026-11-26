"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";

type FormState = {
  institution: string;
  faculty: string;
  course: string;
  yearOfStudy: string;
  moduleCode: string;
  moduleName: string;
  topic: string;
  force: boolean;
};

type JobResult = {
  ok: boolean;
  skipped?: boolean;
  lessonPath?: string;
  error?: string;
};

type GeneratedLesson = {
  id: string;
  institution: string;
  faculty: string;
  course: string;
  yearOfStudy: number;
  moduleCode: string;
  moduleName: string | null;
  title: string | null;
  generatedAt: string;
};

function emptyForm(): FormState {
  return {
    institution: "",
    faculty: "",
    course: "",
    yearOfStudy: "1",
    moduleCode: "",
    moduleName: "",
    topic: "",
    force: false,
  };
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "inherit",
  fontSize: "var(--text-sm)",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  marginBottom: 4,
  color: "var(--color-fg-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

export function AdminUniversityClient() {
  const { session } = useSession();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<JobResult | null>(null);
  const [history, setHistory] = useState<{ input: FormState; result: JobResult; at: string }[]>([]);
  const [lessons, setLessons] = useState<GeneratedLesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);

  const fetchLessons = useCallback(async () => {
    setLoadingLessons(true);
    try {
      const res = await fetch(`${API_BASE}/university/lessons/list?limit=100`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setLessons(data.lessons ?? []);
      }
    } catch {
      // non-fatal — list stays empty
    } finally {
      setLoadingLessons(false);
    }
  }, []);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  function set(field: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function generate() {
    if (!session?.csrfToken) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/admin/university/generate-module`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({
          institution: form.institution.trim(),
          faculty: form.faculty.trim(),
          course: form.course.trim(),
          yearOfStudy: Number(form.yearOfStudy),
          moduleCode: form.moduleCode.trim().toUpperCase(),
          moduleName: form.moduleName.trim() || undefined,
          topic: form.topic.trim() || undefined,
          force: form.force,
        }),
      });
      const data: JobResult = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
      if (!res.ok) data.ok = false;
      setResult(data);
      setHistory((prev) => [{ input: { ...form }, result: data, at: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
      if (data.ok && !data.skipped) {
        fetchLessons();
      }
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setRunning(false);
    }
  }

  const canSubmit =
    form.institution.trim() &&
    form.faculty.trim() &&
    form.course.trim() &&
    form.moduleCode.trim() &&
    Number(form.yearOfStudy) >= 1;

  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      <div>
        <h2 style={{ margin: 0 }}>University Module Lesson Generator</h2>
        <p style={{ margin: "4px 0 0", color: "var(--color-fg-muted)", fontSize: "var(--text-sm)" }}>
          Generate AI-authored undergraduate study content for any module. Requires{" "}
          <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}>OPENAI_API_KEY</code> in the API environment.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Institution *</label>
          <input
            style={inputStyle}
            value={form.institution}
            onChange={(e) => set("institution", e.target.value)}
            placeholder="e.g. University of Johannesburg"
          />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Faculty *</label>
          <input
            style={inputStyle}
            value={form.faculty}
            onChange={(e) => set("faculty", e.target.value)}
            placeholder="e.g. College of Business and Economics"
          />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Degree / Course *</label>
          <input
            style={inputStyle}
            value={form.course}
            onChange={(e) => set("course", e.target.value)}
            placeholder="e.g. Bachelor of Commerce"
          />
        </div>

        <div>
          <label style={labelStyle}>Year of Study *</label>
          <input
            style={inputStyle}
            type="number"
            min={1}
            max={8}
            value={form.yearOfStudy}
            onChange={(e) => set("yearOfStudy", e.target.value)}
          />
        </div>

        <div>
          <label style={labelStyle}>Module Code *</label>
          <input
            style={inputStyle}
            value={form.moduleCode}
            onChange={(e) => set("moduleCode", e.target.value.toUpperCase())}
            placeholder="e.g. ECON211"
          />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Module Name</label>
          <input
            style={inputStyle}
            value={form.moduleName}
            onChange={(e) => set("moduleName", e.target.value)}
            placeholder="e.g. Macroeconomics (optional)"
          />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Topic Focus</label>
          <input
            style={inputStyle}
            value={form.topic}
            onChange={(e) => set("topic", e.target.value)}
            placeholder="e.g. IS-LM model (optional — narrows the lesson)"
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            id="force"
            checked={form.force}
            onChange={(e) => set("force", e.target.checked)}
          />
          <label htmlFor="force" style={{ fontSize: "var(--text-sm)", cursor: "pointer" }}>
            Force regenerate (overwrite existing)
          </label>
        </div>
      </div>

      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
        <button
          className="button"
          onClick={generate}
          disabled={running || !canSubmit}
        >
          {running ? "Generating… (may take 30–60 s)" : "Generate Module Lesson"}
        </button>
        <button className="button" onClick={() => { setForm(emptyForm()); setResult(null); }}>
          Clear
        </button>
      </div>

      {result && (
        <div
          style={{
            padding: "12px",
            borderRadius: "var(--radius-md)",
            border: `1px solid ${result.ok ? "var(--color-success, #22c55e)" : "var(--color-error)"}`,
            background: "var(--color-surface-raised)",
          }}
        >
          {result.ok ? (
            <>
              <strong style={{ color: "var(--color-success, #22c55e)" }}>
                {result.skipped ? "Already exists — skipped (enable Force to regenerate)" : "Generated and saved to database"}
              </strong>
              {result.lessonPath && (
                <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)" }}>
                  {result.lessonPath}
                </p>
              )}
            </>
          ) : (
            <>
              <strong style={{ color: "var(--color-error)" }}>Generation failed</strong>
              <p style={{ margin: "4px 0 0", fontSize: "var(--text-sm)" }}>{result.error}</p>
            </>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          <strong style={{ fontSize: "var(--text-sm)" }}>Session jobs</strong>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-xs)" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  {["Time", "Module", "Institution", "Status"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((entry, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "4px 8px", color: "var(--color-fg-muted)" }}>{entry.at}</td>
                    <td style={{ padding: "4px 8px", fontFamily: "var(--font-mono)" }}>
                      {entry.input.moduleCode} · Yr {entry.input.yearOfStudy}
                    </td>
                    <td style={{ padding: "4px 8px", color: "var(--color-fg-muted)" }}>
                      {entry.input.institution}
                    </td>
                    <td style={{ padding: "4px 8px" }}>
                      <span style={{ color: entry.result.ok ? "var(--color-success, #22c55e)" : "var(--color-error)" }}>
                        {entry.result.ok ? (entry.result.skipped ? "Skipped" : "Done") : "Failed"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: "var(--space-2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <strong style={{ fontSize: "var(--text-sm)" }}>
            Generated lessons {lessons.length > 0 ? `(${lessons.length})` : ""}
          </strong>
          <button
            className="button"
            onClick={fetchLessons}
            disabled={loadingLessons}
            style={{ fontSize: "var(--text-xs)", padding: "2px 8px" }}
          >
            {loadingLessons ? "Loading…" : "Refresh"}
          </button>
        </div>

        {lessons.length === 0 ? (
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-fg-muted)" }}>
            {loadingLessons ? "Loading…" : "No lessons generated yet. Use the form above to create the first one."}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-xs)" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  {["Module", "Yr", "Institution", "Course", "Title", "Generated"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lessons.map((lesson) => (
                  <tr key={lesson.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "4px 8px", fontFamily: "var(--font-mono)" }}>
                      <a
                        href={`/university/modules/${lesson.moduleCode.toLowerCase()}`}
                        style={{ color: "var(--color-accent)", textDecoration: "none" }}
                      >
                        {lesson.moduleCode}
                      </a>
                    </td>
                    <td style={{ padding: "4px 8px", color: "var(--color-fg-muted)" }}>
                      {lesson.yearOfStudy}
                    </td>
                    <td style={{ padding: "4px 8px", color: "var(--color-fg-muted)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {lesson.institution}
                    </td>
                    <td style={{ padding: "4px 8px", color: "var(--color-fg-muted)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {lesson.course}
                    </td>
                    <td style={{ padding: "4px 8px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {lesson.title ?? <span style={{ color: "var(--color-fg-muted)" }}>—</span>}
                    </td>
                    <td style={{ padding: "4px 8px", color: "var(--color-fg-muted)", whiteSpace: "nowrap" }}>
                      {new Date(lesson.generatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
