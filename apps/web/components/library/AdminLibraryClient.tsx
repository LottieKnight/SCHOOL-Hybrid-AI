"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";

type ContentType = "article" | "book" | "journal" | "publication" | "past_paper" | "video_lesson";
type GradeBand = "foundation" | "intermediate" | "senior" | "fet" | "university" | "all";
type AccessType = "free" | "premium" | "subscription";
type FileType = "pdf" | "epub" | "link" | "video" | "html";

type LibraryResource = {
  id: string;
  title: string;
  content_type: ContentType;
  subject: string | null;
  grade_band: GradeBand | null;
  access_type: AccessType;
  author: string | null;
  is_active: boolean;
  created_at: string;
};

type FormState = {
  title: string;
  description: string;
  content_type: ContentType;
  subject: string;
  grade_band: GradeBand | "";
  topic_tags: string;
  author: string;
  publisher: string;
  published_year: string;
  language: string;
  access_type: AccessType;
  thumbnail_url: string;
  resource_url: string;
  storage_key: string;
  file_type: FileType | "";
  file_size_bytes: string;
};

function emptyForm(): FormState {
  return {
    title: "",
    description: "",
    content_type: "article",
    subject: "",
    grade_band: "",
    topic_tags: "",
    author: "",
    publisher: "",
    published_year: "",
    language: "en",
    access_type: "free",
    thumbnail_url: "",
    resource_url: "",
    storage_key: "",
    file_type: "",
    file_size_bytes: "",
  };
}

const CONTENT_TYPES: ContentType[] = ["article", "book", "journal", "publication", "past_paper", "video_lesson"];
const GRADE_BANDS: GradeBand[] = ["foundation", "intermediate", "senior", "fet", "university", "all"];
const ACCESS_TYPES: AccessType[] = ["free", "premium", "subscription"];
const FILE_TYPES: FileType[] = ["pdf", "epub", "link", "video", "html"];

function label(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AdminLibraryClient() {
  const { session } = useSession();
  const [resources, setResources] = useState<LibraryResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/library/resources?limit=100&offset=0`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setResources(data.resources ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load resources");
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setForm(emptyForm());
    setEditingId(null);
    setSaveError(null);
    setShowForm(true);
  }

  function openEdit(r: LibraryResource) {
    setForm({
      title: r.title,
      description: "",
      content_type: r.content_type,
      subject: r.subject ?? "",
      grade_band: r.grade_band ?? "",
      topic_tags: "",
      author: r.author ?? "",
      publisher: "",
      published_year: "",
      language: "en",
      access_type: r.access_type,
      thumbnail_url: "",
      resource_url: "",
      storage_key: "",
      file_type: "",
      file_size_bytes: "",
    });
    setEditingId(r.id);
    setSaveError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setSaveError(null);
  }

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function save() {
    if (!session?.csrfToken) {
      setSaveError("Not authenticated");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        content_type: form.content_type,
        language: form.language || "en",
        access_type: form.access_type,
      };
      if (form.description.trim()) body.description = form.description.trim();
      if (form.subject.trim()) body.subject = form.subject.trim();
      if (form.grade_band) body.grade_band = form.grade_band;
      if (form.topic_tags.trim()) {
        body.topic_tags = form.topic_tags.split(",").map((t) => t.trim()).filter(Boolean);
      }
      if (form.author.trim()) body.author = form.author.trim();
      if (form.publisher.trim()) body.publisher = form.publisher.trim();
      if (form.published_year.trim()) body.published_year = Number(form.published_year);
      if (form.thumbnail_url.trim()) body.thumbnail_url = form.thumbnail_url.trim();
      if (form.resource_url.trim()) body.resource_url = form.resource_url.trim();
      if (form.storage_key.trim()) body.storage_key = form.storage_key.trim();
      if (form.file_type) body.file_type = form.file_type;
      if (form.file_size_bytes.trim()) body.file_size_bytes = Number(form.file_size_bytes);

      const url = editingId
        ? `${API_BASE}/admin/library/resources/${editingId}`
        : `${API_BASE}/admin/library/resources`;
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `${res.status}`);
      }
      closeForm();
      load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function softDelete(id: string) {
    if (!session?.csrfToken) return;
    try {
      await fetch(`${API_BASE}/admin/library/resources/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "x-csrf-token": session.csrfToken },
      });
      setDeleteConfirm(null);
      load();
    } catch {
      // silently reload
      load();
    }
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

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
        <div>
          <h2 style={{ margin: 0 }}>Library Resources</h2>
          <p style={{ margin: 0, color: "var(--color-fg-muted)", fontSize: "var(--text-sm)" }}>
            {resources.length} resource{resources.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button className="button" onClick={openNew}>
          + New Resource
        </button>
      </div>

      {error && <p style={{ color: "var(--color-error)" }}>{error}</p>}

      {loading && <p style={{ color: "var(--color-fg-muted)" }}>Loading…</p>}

      {!loading && resources.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: "var(--space-6) 0", color: "var(--color-fg-muted)" }}>
          <p>No resources yet. Create the first one above.</p>
        </div>
      )}

      {resources.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--color-border)" }}>
                {["Title", "Type", "Subject", "Grade Band", "Access", "Created", ""].map((h) => (
                  <th
                    key={h}
                    style={{ textAlign: "left", padding: "6px 10px", fontWeight: 600, whiteSpace: "nowrap" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "8px 10px", maxWidth: 260 }}>
                    <a href={`/library/${r.id}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 500 }}>
                      {r.title}
                    </a>
                    {r.author && (
                      <span style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--color-fg-muted)" }}>
                        {r.author}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: "var(--radius-full)",
                        background: "var(--color-surface-raised)",
                        fontSize: "var(--text-xs)",
                      }}
                    >
                      {label(r.content_type)}
                    </span>
                  </td>
                  <td style={{ padding: "8px 10px", color: "var(--color-fg-muted)" }}>{r.subject ?? "—"}</td>
                  <td style={{ padding: "8px 10px", color: "var(--color-fg-muted)", textTransform: "capitalize" }}>
                    {r.grade_band ?? "—"}
                  </td>
                  <td style={{ padding: "8px 10px", textTransform: "capitalize" }}>{r.access_type}</td>
                  <td style={{ padding: "8px 10px", color: "var(--color-fg-muted)", whiteSpace: "nowrap" }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="button"
                        style={{ padding: "3px 10px", fontSize: "var(--text-xs)" }}
                        onClick={() => openEdit(r)}
                      >
                        Edit
                      </button>
                      {deleteConfirm === r.id ? (
                        <>
                          <button
                            className="button"
                            style={{ padding: "3px 10px", fontSize: "var(--text-xs)", color: "var(--color-error)" }}
                            onClick={() => softDelete(r.id)}
                          >
                            Confirm
                          </button>
                          <button
                            className="button"
                            style={{ padding: "3px 10px", fontSize: "var(--text-xs)" }}
                            onClick={() => setDeleteConfirm(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="button"
                          style={{ padding: "3px 10px", fontSize: "var(--text-xs)" }}
                          onClick={() => setDeleteConfirm(r.id)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "var(--space-4)",
          }}
          onClick={(e) => e.target === e.currentTarget && closeForm()}
        >
          <div
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-4)",
              width: "100%",
              maxWidth: 640,
              maxHeight: "90vh",
              overflowY: "auto",
              display: "grid",
              gap: "var(--space-3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "var(--text-lg)" }}>
                {editingId ? "Edit Resource" : "New Resource"}
              </strong>
              <button onClick={closeForm} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20 }}>
                ×
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Title *</label>
                <input style={inputStyle} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Resource title" />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Description</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Short description of this resource"
                />
              </div>

              <div>
                <label style={labelStyle}>Content Type *</label>
                <select style={inputStyle} value={form.content_type} onChange={(e) => set("content_type", e.target.value as ContentType)}>
                  {CONTENT_TYPES.map((t) => (
                    <option key={t} value={t}>{label(t)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Access Type</label>
                <select style={inputStyle} value={form.access_type} onChange={(e) => set("access_type", e.target.value as AccessType)}>
                  {ACCESS_TYPES.map((t) => (
                    <option key={t} value={t}>{label(t)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Subject</label>
                <input style={inputStyle} value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="e.g. Mathematics" />
              </div>

              <div>
                <label style={labelStyle}>Grade Band</label>
                <select style={inputStyle} value={form.grade_band} onChange={(e) => set("grade_band", e.target.value as GradeBand | "")}>
                  <option value="">— Any —</option>
                  {GRADE_BANDS.map((g) => (
                    <option key={g} value={g}>{label(g)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Author</label>
                <input style={inputStyle} value={form.author} onChange={(e) => set("author", e.target.value)} placeholder="Author name" />
              </div>

              <div>
                <label style={labelStyle}>Publisher</label>
                <input style={inputStyle} value={form.publisher} onChange={(e) => set("publisher", e.target.value)} placeholder="Publisher name" />
              </div>

              <div>
                <label style={labelStyle}>Published Year</label>
                <input style={inputStyle} type="number" value={form.published_year} onChange={(e) => set("published_year", e.target.value)} placeholder="e.g. 2024" min={1800} max={2100} />
              </div>

              <div>
                <label style={labelStyle}>Language</label>
                <input style={inputStyle} value={form.language} onChange={(e) => set("language", e.target.value)} placeholder="en" maxLength={10} />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Topic Tags (comma-separated)</label>
                <input style={inputStyle} value={form.topic_tags} onChange={(e) => set("topic_tags", e.target.value)} placeholder="Algebra, Functions, Calculus" />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Resource URL</label>
                <input style={inputStyle} value={form.resource_url} onChange={(e) => set("resource_url", e.target.value)} placeholder="https://…" type="url" />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Thumbnail URL</label>
                <input style={inputStyle} value={form.thumbnail_url} onChange={(e) => set("thumbnail_url", e.target.value)} placeholder="https://…" type="url" />
              </div>

              <div>
                <label style={labelStyle}>File Type</label>
                <select style={inputStyle} value={form.file_type} onChange={(e) => set("file_type", e.target.value as FileType | "")}>
                  <option value="">— None —</option>
                  {FILE_TYPES.map((t) => (
                    <option key={t} value={t}>{t.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>File Size (bytes)</label>
                <input style={inputStyle} type="number" value={form.file_size_bytes} onChange={(e) => set("file_size_bytes", e.target.value)} placeholder="e.g. 1048576" min={0} />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Storage Key</label>
                <input style={inputStyle} value={form.storage_key} onChange={(e) => set("storage_key", e.target.value)} placeholder="content/library/…" maxLength={500} />
              </div>
            </div>

            {saveError && (
              <p style={{ color: "var(--color-error)", margin: 0, fontSize: "var(--text-sm)" }}>{saveError}</p>
            )}

            <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
              <button className="button" onClick={closeForm} disabled={saving}>
                Cancel
              </button>
              <button className="button" onClick={save} disabled={saving || !form.title.trim()}>
                {saving ? "Saving…" : editingId ? "Save Changes" : "Create Resource"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
