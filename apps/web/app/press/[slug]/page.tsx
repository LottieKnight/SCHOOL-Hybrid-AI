"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LICENSE_LABELS, LICENSE_URLS } from "@/lib/press/constants";
import { useSession } from "@/components/SessionProvider";
import { getApiErrorMessage } from "@/lib/apiBase";
import { pressClient, type PressWorkDetail } from "@/lib/press/pressClient";
import styles from "./page.module.css";

const KIND_LABELS: Record<string, string> = {
  paper: "Paper",
  essay: "Essay",
  literature: "Literature",
  design: "Design",
  dataset_note: "Dataset note",
  other: "Work",
};

export default function PressWorkPage() {
  const { slug } = useParams<{ slug: string }>();
  const { session } = useSession();
  const router = useRouter();
  const [detail, setDetail] = useState<PressWorkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const data = await pressClient.work(slug);
      setDetail(data);
    } catch (err) {
      setNotFound(true);
      setError(getApiErrorMessage(err, "Could not load this work."));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const isOwner = Boolean(session && detail && session.user.id === detail.work.author_id);

  const doPublish = async () => {
    if (!session || !detail || busy) return;
    setBusy(true);
    setError(null);
    try {
      await pressClient.publish(detail.work.id, session.csrfToken);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not publish."));
    } finally {
      setBusy(false);
    }
  };

  const doWithdraw = async () => {
    if (!session || !detail || busy) return;
    setBusy(true);
    setError(null);
    try {
      await pressClient.withdraw(detail.work.id, session.csrfToken);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not withdraw."));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.wrap}>
        <p className={styles.muted}>Loading…</p>
      </div>
    );
  }

  if (notFound || !detail) {
    return (
      <div className={styles.wrap}>
        <Link href="/press" className={styles.back}>
          ← SCHOOL Press
        </Link>
        <p className={styles.muted}>This work is private, doesn&apos;t exist, or has been withdrawn.</p>
      </div>
    );
  }

  const { work, authors, versions, references } = detail;
  const latest = versions[0] ?? null;
  const licenseUrl = LICENSE_URLS[work.license];

  return (
    <article className={styles.wrap}>
      <Link href="/press" className={styles.back}>
        ← SCHOOL Press
      </Link>

      {work.status !== "published" && work.status !== "curated" && (
        <div className={styles.statusBanner} data-status={work.status}>
          {work.status === "draft" ? "Draft — only you can see this." : `Status: ${work.status}`}
        </div>
      )}

      <header className={styles.head}>
        <span className={styles.kind}>{KIND_LABELS[work.kind] ?? work.kind}</span>
        <h1 className={styles.title}>{work.title}</h1>
        <p className={styles.byline}>
          {authors.length > 0 ? authors.map((a) => a.display_name).join(", ") : "Anonymous"}
        </p>
        {work.discipline_tags.length > 0 && (
          <div className={styles.tags}>
            {work.discipline_tags.map((t) => (
              <span key={t} className={styles.tag}>
                {t}
              </span>
            ))}
          </div>
        )}
      </header>

      {error && <p className={styles.error}>{error}</p>}

      {isOwner && (
        <div className={styles.ownerBar}>
          {work.status === "draft" && (
            <button className={styles.primary} onClick={doPublish} disabled={busy}>
              {busy ? "Publishing…" : "Publish"}
            </button>
          )}
          {(work.status === "published" || work.status === "curated") && (
            <button className={styles.secondary} onClick={doWithdraw} disabled={busy}>
              {busy ? "Withdrawing…" : "Withdraw"}
            </button>
          )}
        </div>
      )}

      {/* Gallery layout — images first */}
      {work.layout === "gallery" && latest && latest.image_urls.length > 0 && (
        <div className={styles.gallery}>
          {latest.image_urls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt={`${work.title} — ${i + 1}`} className={styles.galleryImg} />
          ))}
        </div>
      )}

      {work.abstract && (
        <section className={styles.section}>
          <h2 className={styles.h2}>{work.layout === "gallery" ? "Statement" : "Abstract"}</h2>
          <p className={styles.body}>{work.abstract}</p>
        </section>
      )}

      {work.body_md && (
        <section className={styles.section}>
          <div className={styles.body} style={{ whiteSpace: "pre-wrap" }}>
            {work.body_md}
          </div>
        </section>
      )}

      {latest?.file_url && (
        <section className={styles.section}>
          <a className={styles.download} href={latest.file_url} target="_blank" rel="noopener noreferrer">
            ↓ Download (version {latest.version})
          </a>
        </section>
      )}

      {references.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.h2}>References</h2>
          <ol className={styles.refs}>
            {references.map((r) => (
              <li key={r.id}>
                {r.raw}
                {r.doi && (
                  <>
                    {" "}
                    <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noopener noreferrer">
                      https://doi.org/{r.doi}
                    </a>
                  </>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className={styles.meta}>
        <div>
          <span className={styles.metaKey}>License</span>
          {licenseUrl ? (
            <a href={licenseUrl} target="_blank" rel="noopener noreferrer" className={styles.metaVal}>
              {LICENSE_LABELS[work.license]}
            </a>
          ) : (
            <span className={styles.metaVal}>{LICENSE_LABELS[work.license]}</span>
          )}
        </div>
        {work.doi && (
          <div>
            <span className={styles.metaKey}>DOI</span>
            <a
              href={`https://doi.org/${work.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.metaVal}
            >
              {work.doi}
            </a>
          </div>
        )}
        {work.published_at && (
          <div>
            <span className={styles.metaKey}>Published</span>
            <span className={styles.metaVal}>
              {new Date(work.published_at).toLocaleDateString("en-ZA", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        )}
      </footer>
    </article>
  );
}
