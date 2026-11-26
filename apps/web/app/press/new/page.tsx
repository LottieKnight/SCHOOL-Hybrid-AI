"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DEFAULT_LICENSE,
  LICENSE_LABELS,
  WORK_KINDS,
  WORK_LICENSES,
  type WorkInput,
  type WorkKind,
  type WorkLayout,
  type WorkLicense,
} from "@/lib/press/constants";
import { useSession } from "@/components/SessionProvider";
import { getApiErrorMessage } from "@/lib/apiBase";
import { pressClient } from "@/lib/press/pressClient";
import styles from "./page.module.css";

const KIND_LABELS: Record<WorkKind, string> = {
  paper: "Paper",
  essay: "Essay",
  literature: "Literature (poem, story, prose)",
  design: "Design / visual work",
  dataset_note: "Dataset note",
  other: "Other",
};

interface AuthorRow {
  displayName: string;
  affiliation: string;
}

export default function PressNewPage() {
  const { session, loading: sessionLoading } = useSession();
  const router = useRouter();

  const [kind, setKind] = useState<WorkKind>("essay");
  const [layout, setLayout] = useState<WorkLayout>("written");
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [tags, setTags] = useState("");
  const [license, setLicense] = useState<WorkLicense>(DEFAULT_LICENSE);
  const [authors, setAuthors] = useState<AuthorRow[]>([{ displayName: "", affiliation: "" }]);
  const [fileUrl, setFileUrl] = useState("");
  const [imageUrls, setImageUrls] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [references, setReferences] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill the first author with the signed-in user's name.
  useEffect(() => {
    if (session?.user) {
      const name = `${session.user.firstName ?? ""} ${session.user.lastName ?? ""}`.trim();
      setAuthors((prev) =>
        prev.length === 1 && !prev[0].displayName ? [{ displayName: name, affiliation: "" }] : prev
      );
    }
  }, [session]);

  if (!sessionLoading && !session) {
    return (
      <div className={styles.wrap}>
        <Link href="/press" className={styles.back}>
          ← SCHOOL Press
        </Link>
        <div className={styles.gate}>
          <h1 className={styles.title}>Sign in to publish</h1>
          <p className={styles.muted}>You need a SCHOOL account to publish a work.</p>
          <Link href="/auth/login" className={styles.primary}>
            Log in
          </Link>
        </div>
      </div>
    );
  }

  const buildInput = (): WorkInput => ({
    kind,
    layout,
    title: title.trim(),
    abstract: abstract.trim() || null,
    bodyMd: layout === "written" ? bodyMd.trim() || null : null,
    disciplineTags: tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20),
    license,
    authors: authors
      .filter((a) => a.displayName.trim())
      .map((a) => ({ displayName: a.displayName.trim(), affiliation: a.affiliation.trim() || null })),
    references: references
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean)
      .map((raw) => ({ raw })),
    coverUrl: coverUrl.trim() || null,
  });

  const submit = async (publish: boolean) => {
    if (!session || busy) return;
    if (!title.trim()) {
      setError("A title is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { work } = await pressClient.create(buildInput(), session.csrfToken);

      const images = imageUrls
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean);
      if (fileUrl.trim() || images.length > 0) {
        await pressClient.addVersion(
          work.id,
          { fileUrl: fileUrl.trim() || null, imageUrls: images },
          session.csrfToken
        );
      }

      if (publish) {
        await pressClient.publish(work.id, session.csrfToken);
      }

      router.push(`/press/${work.slug}`);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not save your work."));
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <Link href="/press" className={styles.back}>
        ← SCHOOL Press
      </Link>
      <h1 className={styles.title}>Publish a work</h1>
      <p className={styles.muted}>
        Files are referenced by URL in v1 — paste a link to your PDF or images (e.g. a Drive or
        storage link). You can save a draft and publish later.
      </p>

      {error && <p className={styles.error}>{error}</p>}

      <label className={styles.label}>Type of work</label>
      <select className={styles.input} value={kind} onChange={(e) => setKind(e.target.value as WorkKind)}>
        {WORK_KINDS.map((k) => (
          <option key={k} value={k}>
            {KIND_LABELS[k]}
          </option>
        ))}
      </select>

      <label className={styles.label}>Layout</label>
      <div className={styles.segment}>
        <button
          type="button"
          className={styles.segBtn}
          data-active={layout === "written"}
          onClick={() => setLayout("written")}
        >
          Written
        </button>
        <button
          type="button"
          className={styles.segBtn}
          data-active={layout === "gallery"}
          onClick={() => setLayout("gallery")}
        >
          Gallery (visual)
        </button>
      </div>

      <label className={styles.label}>Title *</label>
      <input
        className={styles.input}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={300}
        placeholder="The title of your work"
      />

      <label className={styles.label}>{layout === "gallery" ? "Artist's statement" : "Abstract"}</label>
      <textarea
        className={styles.textarea}
        value={abstract}
        onChange={(e) => setAbstract(e.target.value)}
        rows={3}
        maxLength={8000}
        placeholder={layout === "gallery" ? "A short statement about the work…" : "A short summary…"}
      />

      {layout === "written" && (
        <>
          <label className={styles.label}>Body (optional — for essays, poems, prose)</label>
          <textarea
            className={styles.textarea}
            value={bodyMd}
            onChange={(e) => setBodyMd(e.target.value)}
            rows={10}
            placeholder="Write or paste your work here…"
          />
        </>
      )}

      <label className={styles.label}>Authors</label>
      {authors.map((a, i) => (
        <div key={i} className={styles.authorRow}>
          <input
            className={styles.input}
            value={a.displayName}
            onChange={(e) => {
              const next = [...authors];
              next[i] = { ...next[i], displayName: e.target.value };
              setAuthors(next);
            }}
            placeholder="Author name"
            maxLength={160}
          />
          <input
            className={styles.input}
            value={a.affiliation}
            onChange={(e) => {
              const next = [...authors];
              next[i] = { ...next[i], affiliation: e.target.value };
              setAuthors(next);
            }}
            placeholder="Affiliation (optional)"
            maxLength={200}
          />
          {authors.length > 1 && (
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => setAuthors(authors.filter((_, j) => j !== i))}
              aria-label="Remove author"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        className={styles.addBtn}
        onClick={() => setAuthors([...authors, { displayName: "", affiliation: "" }])}
      >
        + Add co-author
      </button>

      <label className={styles.label}>Discipline tags (comma-separated)</label>
      <input
        className={styles.input}
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="e.g. Psychology, Poetry, Design"
      />

      <label className={styles.label}>License</label>
      <select
        className={styles.input}
        value={license}
        onChange={(e) => setLicense(e.target.value as WorkLicense)}
      >
        {WORK_LICENSES.map((l) => (
          <option key={l} value={l}>
            {LICENSE_LABELS[l]}
          </option>
        ))}
      </select>
      <p className={styles.hint}>
        CC BY 4.0 is recommended — it maximises reuse and citation while guaranteeing you credit.
      </p>

      {layout === "gallery" ? (
        <>
          <label className={styles.label}>Image URLs (one per line)</label>
          <textarea
            className={styles.textarea}
            value={imageUrls}
            onChange={(e) => setImageUrls(e.target.value)}
            rows={4}
            placeholder="https://…/image1.jpg&#10;https://…/image2.jpg"
          />
        </>
      ) : (
        <>
          <label className={styles.label}>File URL (PDF / document — optional)</label>
          <input
            className={styles.input}
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            placeholder="https://…/work.pdf"
          />
        </>
      )}

      <label className={styles.label}>Cover image URL (optional)</label>
      <input
        className={styles.input}
        value={coverUrl}
        onChange={(e) => setCoverUrl(e.target.value)}
        placeholder="https://…/cover.jpg"
      />

      <label className={styles.label}>References (one per line, optional)</label>
      <textarea
        className={styles.textarea}
        value={references}
        onChange={(e) => setReferences(e.target.value)}
        rows={4}
        placeholder="Simons, D. J., & Chabris, C. F. (1999)…"
      />

      <div className={styles.actions}>
        <button className={styles.secondary} onClick={() => submit(false)} disabled={busy}>
          {busy ? "Saving…" : "Save as draft"}
        </button>
        <button className={styles.primary} onClick={() => submit(true)} disabled={busy}>
          {busy ? "Publishing…" : "Publish now"}
        </button>
      </div>
    </div>
  );
}
