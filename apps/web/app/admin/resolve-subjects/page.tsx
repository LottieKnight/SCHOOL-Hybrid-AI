"use client";

import { useEffect, useMemo, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { AdminQuickLinks } from "@/components/AdminQuickLinks";

type UnclassifiedItem = {
  phase: string;
  grade: string;
  source_subject_key: string;
  reason: string;
  week_count: number;
  resources_only_count: number;
  sample_paths: string[];
};

type ResolveForm = {
  resolved_subject_key: string;
  phase: string;
  display_name_override: string;
  notes: string;
  confirm_any: boolean;
  confirm_merge: boolean;
};

export default function ResolveSubjectsAdminPage() {
  const [items, setItems] = useState<UnclassifiedItem[]>([]);
  const [subjectKeys, setSubjectKeys] = useState<string[]>([]);
  const [forms, setForms] = useState<Record<string, ResolveForm>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/unclassified-subjects");
        if (!response.ok) {
          throw new Error("Failed to load unclassified subjects.");
        }
        const data = await response.json();
        if (!active) return;
        setItems(data.items || []);
        setSubjectKeys(data.subject_keys || []);
        const initialForms: Record<string, ResolveForm> = {};
        (data.items || []).forEach((item: UnclassifiedItem) => {
          initialForms[item.source_subject_key] = {
            resolved_subject_key: "",
            phase: item.phase,
            display_name_override: "",
            notes: "",
            confirm_any: false,
            confirm_merge: false,
          };
        });
        setForms(initialForms);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "Failed to load data.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const itemsByKey = useMemo(() => {
    return items.reduce((acc, item) => {
      acc[item.source_subject_key] = item;
      return acc;
    }, {} as Record<string, UnclassifiedItem>);
  }, [items]);

  async function handleResolve(sourceKey: string) {
    const form = forms[sourceKey];
    if (!form?.resolved_subject_key) {
      setNotice("Select a resolved subject key before saving.");
      return;
    }
    setNotice(null);
    const response = await fetch("/api/admin/resolve-subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_subject_key: sourceKey,
        phase: form.phase,
        resolved_subject_key: form.resolved_subject_key,
        display_name_override: form.display_name_override || undefined,
        notes: form.notes || undefined,
        confirm_any: form.confirm_any,
        confirm_merge: form.confirm_merge,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setNotice(data?.error || "Failed to save resolution.");
      return;
    }
    setNotice(`Saved resolution for ${sourceKey}.`);
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/resolve-subjects/regenerate", { method: "POST" });
      if (!response.ok) {
        setNotice("Failed to regenerate outline.");
        return;
      }
      setNotice("Generated outline updated.");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="glass card card-with-back">
      <BackLink href="/admin" />
      <Breadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Resolve Subjects" }]} />
      <h1 className="title">Resolve Subjects</h1>
      <p className="subtitle">Map unclassified subject folders to canonical subject keys.</p>
      <AdminQuickLinks />

      <div className="outline-actions">
        <button type="button" className="button" onClick={handleRegenerate} disabled={regenerating}>
          {regenerating ? "Regenerating..." : "Regenerate outline"}
        </button>
        {notice ? <span className="badge">{notice}</span> : null}
      </div>

      {loading ? <p className="badge">Loading...</p> : null}
      {error ? <p className="badge">{error}</p> : null}

      <div className="spacer" />
      <div className="grid">
        {items.map((item) => {
          const form = forms[item.source_subject_key];
          const baseId = item.source_subject_key.replace(/[^a-z0-9_-]/gi, "_");
          const resolveId = `${baseId}-resolve`;
          const phaseId = `${baseId}-phase`;
          const displayId = `${baseId}-display`;
          const notesId = `${baseId}-notes`;
          return (
            <div key={`${item.phase}-${item.grade}-${item.source_subject_key}`} className="list-item">
              <strong>{item.source_subject_key}</strong>
              <div className="badge">{item.phase} Grade {item.grade}</div>
              <div className="badge">{item.week_count} weeks</div>
              <div className="badge">{item.resources_only_count} resources-only</div>
              <div className="badge">{item.reason}</div>
              {item.sample_paths.length ? (
                <div className="badge">{item.sample_paths.join(" | ")}</div>
              ) : null}

              <div className="spacer" />
              <label className="badge" htmlFor={resolveId}>
                Resolve to
              </label>
              <select
                className="input"
                id={resolveId}
                aria-label="Resolve to subject key"
                title="Resolve to subject key"
                value={form?.resolved_subject_key || ""}
                onChange={(event) =>
                  setForms((prev) => ({
                    ...prev,
                    [item.source_subject_key]: {
                      ...prev[item.source_subject_key],
                      resolved_subject_key: event.target.value,
                    },
                  }))
                }
              >
                <option value="">Select subject key</option>
                {subjectKeys.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>

              <div className="spacer" />
              <label className="badge" htmlFor={phaseId}>
                Phase constraint
              </label>
              <select
                className="input"
                id={phaseId}
                aria-label="Phase constraint"
                title="Phase constraint"
                value={form?.phase || item.phase}
                onChange={(event) =>
                  setForms((prev) => ({
                    ...prev,
                    [item.source_subject_key]: {
                      ...prev[item.source_subject_key],
                      phase: event.target.value,
                    },
                  }))
                }
              >
                {["foundation", "intermediate", "senior", "fet", "any"].map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>

              {form?.phase === "any" ? (
                <label className="badge">
                  <input
                    type="checkbox"
                    checked={form.confirm_any}
                    onChange={(event) =>
                      setForms((prev) => ({
                        ...prev,
                        [item.source_subject_key]: {
                          ...prev[item.source_subject_key],
                          confirm_any: event.target.checked,
                        },
                      }))
                    }
                  />{" "}
                  Confirm phase=any
                </label>
              ) : null}

              <label className="badge">
                <input
                  type="checkbox"
                  checked={form?.confirm_merge || false}
                  onChange={(event) =>
                    setForms((prev) => ({
                      ...prev,
                      [item.source_subject_key]: {
                        ...prev[item.source_subject_key],
                        confirm_merge: event.target.checked,
                      },
                    }))
                  }
                />{" "}
                Allow merge with existing rule
              </label>

              <label className="badge" htmlFor={displayId}>
                Display name override (optional)
              </label>
              <input
                className="input"
                id={displayId}
                aria-label="Display name override"
                title="Display name override"
                value={form?.display_name_override || ""}
                onChange={(event) =>
                  setForms((prev) => ({
                    ...prev,
                    [item.source_subject_key]: {
                      ...prev[item.source_subject_key],
                      display_name_override: event.target.value,
                    },
                  }))
                }
              />

              <label className="badge" htmlFor={notesId}>
                Notes
              </label>
              <input
                className="input"
                id={notesId}
                aria-label="Notes"
                title="Notes"
                value={form?.notes || ""}
                onChange={(event) =>
                  setForms((prev) => ({
                    ...prev,
                    [item.source_subject_key]: {
                      ...prev[item.source_subject_key],
                      notes: event.target.value,
                    },
                  }))
                }
              />

              <button type="button" className="button" onClick={() => handleResolve(item.source_subject_key)}>
                Resolve
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
