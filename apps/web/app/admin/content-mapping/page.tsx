"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminQuickLinks } from "@/components/AdminQuickLinks";

type Report = {
  downloaded_count?: number;
  failed_links?: { url: string; error?: string; attempts?: number }[];
  unmapped_files?: { path: string; reason?: string }[];
  normalized_files?: { source: string; destination: string }[];
  reportPath?: string;
  pdfRoot?: string;
};

type MappingEntry = {
  source_rel_path: string;
  phase: string;
  grade: number;
  subject: string;
  term: number;
  week: number;
  resource_type: string;
  notes?: string;
  mapped_at?: string;
};

type Notice = { type: "success" | "error"; message: string };

const phaseOptions = ["foundation", "intermediate", "senior", "fet"];
const resourceTypeOptions = [
  "lesson",
  "worksheet",
  "assessment",
  "memo",
  "resources",
  "slides",
  "teacher_notes",
  "other",
];

function normalizePath(value: string) {
  return value.replace(/\\/g, "/");
}

function toSourceRelPath(filePath: string) {
  const normalized = normalizePath(filePath);
  const lower = normalized.toLowerCase();
  const index = lower.lastIndexOf("/content/pdf/");
  if (index === -1) return null;
  return normalized.slice(index + 1);
}

function guessValue(filePath: string, pattern: RegExp) {
  const match = normalizePath(filePath).match(pattern);
  return match ? match[1] : null;
}

function guessResourceType(filePath: string) {
  const lower = filePath.toLowerCase();
  if (lower.includes("memo") || lower.includes("memorandum")) return "memo";
  if (lower.includes("assessment") || lower.includes("test") || lower.includes("exam")) return "assessment";
  if (lower.includes("worksheet") || lower.includes("activity") || lower.includes("practice")) return "worksheet";
  if (lower.includes("slides") || lower.includes(".ppt")) return "slides";
  if (lower.includes("teacher") || lower.includes("notes")) return "teacher_notes";
  if (lower.includes("lesson")) return "lesson";
  return "resources";
}

export default function ContentMappingAdminPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [tab, setTab] = useState<"unmapped" | "mapped">("unmapped");
  const [recentMappings, setRecentMappings] = useState<MappingEntry[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<{ path: string; reason?: string } | null>(null);
  const [onlyUnmappedSplits, setOnlyUnmappedSplits] = useState(true);
  const [pathQuery, setPathQuery] = useState("unmapped_splits");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjectLoading, setSubjectLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    phase: "foundation",
    grade: 1,
    subject: "",
    term: 1,
    week: 1,
    resource_type: "resources",
    notes: "",
  });

  async function loadReport() {
    try {
      const response = await fetch("/api/admin/unmapped-content", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load report.");
      const data = (await response.json()) as Report;
      setReport(data);
    } catch (err: any) {
      setError(err?.message || "Unable to load report.");
    }
  }

  async function loadRecentMappings() {
    try {
      const response = await fetch("/api/admin/content-mapping/recent", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load recent mappings.");
      const data = await response.json();
      setRecentMappings(data.mappings || []);
    } catch (err: any) {
      setNotice({ type: "error", message: err?.message || "Unable to load recent mappings." });
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadReport();
      } catch (err: any) {
        setError(err?.message || "Unable to load report.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const unmapped = useMemo(() => report?.unmapped_files ?? [], [report?.unmapped_files]);
  const failed = useMemo(() => report?.failed_links ?? [], [report?.failed_links]);

  const pdfRoot = report?.pdfRoot ? report.pdfRoot.replace(/\\/g, "/") : "";
  const filteredUnmapped = useMemo(() => {
    const normalizedQuery = pathQuery.trim().toLowerCase();
    return unmapped.filter((item) => {
      const normalizedPath = normalizePath(item.path).toLowerCase();
      if (onlyUnmappedSplits && !normalizedPath.includes("unmapped_splits")) return false;
      if (normalizedQuery && !normalizedPath.includes(normalizedQuery)) return false;
      return true;
    });
  }, [unmapped, onlyUnmappedSplits, pathQuery]);

  const visibleUnmapped = useMemo(() => filteredUnmapped.slice(0, 200), [filteredUnmapped]);

  function makePdfHref(filePath: string) {
    if (!pdfRoot) return null;
    const normalized = filePath.replace(/\\/g, "/");
    if (!normalized.toLowerCase().endsWith(".pdf")) return null;
    if (!normalized.startsWith(pdfRoot)) return null;
    const relPath = normalized.slice(pdfRoot.length + 1);
    return `/api/content/pdf?path=${encodeURIComponent(relPath)}`;
  }

  async function fetchSubjects(phase: string, grade: number) {
    setSubjectLoading(true);
    try {
      const response = await fetch(
        `/api/admin/content-mapping/subjects?phase=${encodeURIComponent(phase)}&grade=${encodeURIComponent(
          String(grade)
        )}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Unable to load subjects.");
      const data = await response.json();
      setSubjects(data.subjects || []);
    } catch (err: any) {
      setSubjects([]);
      setNotice({ type: "error", message: err?.message || "Unable to load subjects." });
    } finally {
      setSubjectLoading(false);
    }
  }

  function openModal(item: { path: string; reason?: string }) {
    const normalized = normalizePath(item.path);
    const phaseGuess = phaseOptions.find((phaseKey) => normalized.toLowerCase().includes(phaseKey)) || "foundation";
    const gradeGuess = Number(guessValue(normalized, /(?:grade|g)[-_\\s]*([0-9]{1,2})/i) || 1);
    const termGuess = Number(guessValue(normalized, /(?:term|t)[-_\\s]*([0-9]{1,2})/i) || 1);
    const weekGuess = Number(guessValue(normalized, /(?:week|wk|w)[-_\\s]*([0-9]{1,2})/i) || 1);
    const resourceTypeGuess = guessResourceType(normalized);

    setForm({
      phase: phaseGuess,
      grade: Number.isFinite(gradeGuess) ? gradeGuess : 1,
      subject: "",
      term: Number.isFinite(termGuess) ? termGuess : 1,
      week: Number.isFinite(weekGuess) ? weekGuess : 1,
      resource_type: resourceTypeGuess,
      notes: "",
    });
    setFormErrors({});
    setModalItem(item);
    setModalOpen(true);
    fetchSubjects(phaseGuess, Number.isFinite(gradeGuess) ? gradeGuess : 1);
  }

  async function submitMapping() {
    if (!modalItem) return;
    const errors: Record<string, string> = {};
    if (!phaseOptions.includes(form.phase)) errors.phase = "Select a valid phase.";
    if (!Number.isFinite(form.grade) || form.grade < 1 || form.grade > 12) errors.grade = "Grade must be 1-12.";
    if (!form.subject) errors.subject = "Select a subject.";
    if (!Number.isFinite(form.term) || form.term < 1 || form.term > 4) errors.term = "Term must be 1-4.";
    if (!Number.isFinite(form.week) || form.week < 1) errors.week = "Week must be >= 1.";
    if (!resourceTypeOptions.includes(form.resource_type)) errors.resource_type = "Select a resource type.";

    const sourceRelPath = toSourceRelPath(modalItem.path);
    if (!sourceRelPath) errors.source = "Invalid source path.";

    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }

    try {
      const response = await fetch("/api/admin/content-mapping/map", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_rel_path: sourceRelPath,
          phase: form.phase,
          grade: Number(form.grade),
          subject: form.subject,
          term: Number(form.term),
          week: Number(form.week),
          resource_type: form.resource_type,
          notes: form.notes,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to map file.");
      }
      setNotice({ type: "success", message: "File mapped successfully." });
      setModalOpen(false);
      setModalItem(null);
      await loadReport();
      await loadRecentMappings();
    } catch (err: any) {
      setNotice({ type: "error", message: err?.message || "Unable to map file." });
    }
  }

  return (
    <div className="glass card card-with-back">
      <h1 className="title">Content mapping queue</h1>
      <p className="subtitle">Unmapped files need grade/subject/term/week mapping.</p>
      <AdminQuickLinks />

      {loading && <p className="subtitle">Loading report...</p>}
      {error && <div className="badge">{error}</div>}
      {notice && <div className="badge">{notice.message}</div>}

      {!loading && report && (
        <>
          <div className="list-item">
            <strong>Downloaded files</strong>
            <p className="subtitle">{report.downloaded_count ?? 0}</p>
            <p className="subtitle">Unmapped: {unmapped.length}</p>
            <p className="subtitle">Failed downloads: {failed.length}</p>
          </div>

          <div className="outline-actions">
            <button type="button" onClick={() => setTab("unmapped")}>
              Unmapped
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("mapped");
                loadRecentMappings();
              }}
            >
              Mapped recently
            </button>
          </div>

          {tab === "unmapped" && unmapped.length ? (
            <>
              <div className="spacer" />
              <h3>Unmapped files (first {visibleUnmapped.length})</h3>
              <p className="subtitle">
                Showing {visibleUnmapped.length} of {unmapped.length} unmapped
              </p>
              <div className="list-item">
                <label className="badge">
                  <input
                    type="checkbox"
                    checked={onlyUnmappedSplits}
                    onChange={(event) => setOnlyUnmappedSplits(event.target.checked)}
                  />{" "}
                  Only show unmapped_splits
                </label>
                <label className="badge">
                  Path contains
                  <input
                    className="input"
                    aria-label="Path contains"
                    title="Path contains"
                    value={pathQuery}
                    onChange={(event) => setPathQuery(event.target.value)}
                    placeholder="unmapped_splits"
                  />
                </label>
              </div>
              <div className="list">
                {visibleUnmapped.map((item) => {
                  const href = makePdfHref(item.path);
                  return (
                    <div className="list-item" key={item.path}>
                      <strong>Needs mapping</strong>
                      <p className="subtitle">{item.reason || "No reason provided"}</p>
                      <button type="button" className="button" onClick={() => openModal(item)}>
                        Map
                      </button>
                      {href ? (
                        <a href={href} target="_blank" rel="noreferrer">
                          {item.path}
                        </a>
                      ) : (
                        <p className="subtitle">{item.path}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            tab === "unmapped" && <p className="subtitle">All files are mapped.</p>
          )}

          {tab === "mapped" && (
            <>
              <div className="spacer" />
              <h3>Mapped recently</h3>
              {!recentMappings.length ? (
                <p className="subtitle">No mappings yet.</p>
              ) : (
                <div className="list">
                  {recentMappings.map((mapping) => (
                    <div className="list-item" key={`${mapping.source_rel_path}-${mapping.mapped_at}`}>
                      <strong>{mapping.subject}</strong>
                      <p className="subtitle">
                        {mapping.phase} • Grade {mapping.grade} • Term {mapping.term} • Week {mapping.week}
                      </p>
                      <p className="subtitle">Type: {mapping.resource_type}</p>
                      <p className="subtitle">{mapping.source_rel_path}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {failed.length ? (
            <>
              <div className="spacer" />
              <h3>Failed downloads</h3>
              <div className="list">
                {failed.slice(0, 50).map((item) => (
                  <div className="list-item" key={item.url}>
                    <strong>{item.url}</strong>
                    <p className="subtitle">{item.error}</p>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}

      {modalOpen && modalItem && (
        <>
          <button
            type="button"
            className="tutor-modal-overlay"
            onClick={() => {
              setModalOpen(false);
              setModalItem(null);
            }}
          />
          <div className="tutor-modal glass card">
            <h3>Map file</h3>
            <p className="subtitle">{modalItem.path}</p>

            <label>
              Phase
              <select
                value={form.phase}
                aria-label="Phase"
                title="Phase"
                onChange={(event) => {
                  const nextPhase = event.target.value;
                  setForm((prev) => ({ ...prev, phase: nextPhase, subject: "" }));
                  fetchSubjects(nextPhase, form.grade);
                }}
              >
                {phaseOptions.map((phase) => (
                  <option key={phase} value={phase}>
                    {phase}
                  </option>
                ))}
              </select>
              {formErrors.phase && <span className="badge">{formErrors.phase}</span>}
            </label>

            <label>
              Grade
              <input
                type="number"
                min={1}
                max={12}
                value={form.grade}
                aria-label="Grade"
                title="Grade"
                onChange={(event) => {
                  const nextGrade = Number(event.target.value);
                  setForm((prev) => ({ ...prev, grade: nextGrade, subject: "" }));
                  fetchSubjects(form.phase, nextGrade);
                }}
              />
              {formErrors.grade && <span className="badge">{formErrors.grade}</span>}
            </label>

            <label>
              Subject
              <select
                value={form.subject}
                aria-label="Subject"
                title="Subject"
                onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
              >
                <option value="">Select subject</option>
                {subjectLoading ? <option>Loading...</option> : null}
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
              {formErrors.subject && <span className="badge">{formErrors.subject}</span>}
            </label>

            <label>
              Term
              <input
                type="number"
                min={1}
                max={4}
                value={form.term}
                aria-label="Term"
                title="Term"
                onChange={(event) => setForm((prev) => ({ ...prev, term: Number(event.target.value) }))}
              />
              {formErrors.term && <span className="badge">{formErrors.term}</span>}
            </label>

            <label>
              Week
              <input
                type="number"
                min={1}
                value={form.week}
                aria-label="Week"
                title="Week"
                onChange={(event) => setForm((prev) => ({ ...prev, week: Number(event.target.value) }))}
              />
              {formErrors.week && <span className="badge">{formErrors.week}</span>}
            </label>

            <label>
              Resource type
              <select
                value={form.resource_type}
                aria-label="Resource type"
                title="Resource type"
                onChange={(event) => setForm((prev) => ({ ...prev, resource_type: event.target.value }))}
              >
                {resourceTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {formErrors.resource_type && <span className="badge">{formErrors.resource_type}</span>}
            </label>

            <label>
              Notes (optional)
              <textarea
                rows={2}
                value={form.notes}
                aria-label="Notes"
                title="Notes"
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </label>

            {formErrors.source && <div className="badge">{formErrors.source}</div>}

            <div className="outline-actions">
              <button type="button" onClick={submitMapping}>
                Save mapping
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setModalItem(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
