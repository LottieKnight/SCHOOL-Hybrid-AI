import Link from "next/link";
import { notFound } from "next/navigation";
import { getPastPaperWithSourceById, getPastPaperAttemptStats } from "@/lib/pastPapers/catalog";
import { getStorageProvider } from "@/lib/storage";
import { getUserContextFromRequest } from "@/lib/pastPapers/auth";
import { pastPapersOpsLog } from "@/lib/pastPapers/opsLogger";
import { PastPaperBookmarkButton } from "@/components/PastPaperBookmarkButton";

export const runtime = "nodejs";

function formatGrade(grade: number | null): string {
  if (grade === null) return "";
  if (grade === 0) return "Grade R";
  return `Grade ${grade}`;
}

function buildViewerHref(fileUrl: string, title: string, memoUrl?: string | null): string {
  let url = "/past-papers/viewer?file=" + encodeURIComponent(fileUrl) + "&title=" + encodeURIComponent(title);
  if (memoUrl) {
    url += "&memo=" + encodeURIComponent(memoUrl);
  }
  return url;
}

// Use the storage key (ingested filename) to determine file type — it's more
// reliable than the original URL which may be a redirect (LinkClick.aspx etc.)
function storageKeyIsPdf(key: string | null, fallbackUrl: string | null): boolean {
  if (key) return key.toLowerCase().endsWith(".pdf");
  if (fallbackUrl) return fallbackUrl.split("?")[0].toLowerCase().endsWith(".pdf");
  return false;
}

async function safeGetSignedUrl(
  key: string | null,
  context: string,
  fallback: string | null = null,
): Promise<string | null> {
  if (!key) return fallback;
  const provider = getStorageProvider();
  try {
    const url = await provider.getSignedUrl(key);
    // LocalStorageProvider returns a /past-papers/ path that only exists on the
    // local dev machine — fall back to the original source URL on Vercel.
    if (url.startsWith("/past-papers/")) return fallback ?? url;
    return url;
  } catch (error) {
    pastPapersOpsLog("error", "storage.signed_url.page_failed", {
      key,
      context,
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

export default async function PastPaperDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const paper = await getPastPaperWithSourceById(id);
  if (!paper) notFound();

  const { userId } = await getUserContextFromRequest();

  const [paperUrl, memoUrl, attemptStats] = await Promise.all([
    safeGetSignedUrl(paper.paperStorageKey, "detail.paper", paper.paperUrlOriginal ?? null),
    safeGetSignedUrl(paper.memoStorageKey, "detail.memo", paper.memoUrlOriginal ?? null),
    userId ? getPastPaperAttemptStats(userId, paper.id) : Promise.resolve({ count: 0, bestScore: null }),
  ]);

  const gradeLabel = formatGrade(paper.grade);
  const metaParts = [
    gradeLabel,
    paper.year ? String(paper.year) : null,
    paper.session || null,
    `Paper ${paper.paperNumber}`,
    paper.language,
    paper.totalMarks ? `${paper.totalMarks} marks` : null,
    paper.durationMinutes ? `${paper.durationMinutes} min` : null,
  ].filter(Boolean);

  const paperViewerHref = paperUrl
    ? buildViewerHref(paperUrl, `${paper.subject} — ${paper.year} ${paper.session} (Paper)`)
    : null;
  const memoViewerHref = memoUrl
    ? buildViewerHref(memoUrl, `${paper.subject} — ${paper.year} ${paper.session} (Memo)`)
    : null;
  const splitViewerHref = paperUrl && memoUrl
    ? buildViewerHref(paperUrl, `${paper.subject} — ${paper.year} ${paper.session}`, memoUrl)
    : null;
  const attemptHref = `/past-papers/${paper.id}/attempt`;

  return (
    <section className="card glass pp-detail">
      <div className="pp-detail-nav">
        <Link href="/past-papers" className="pp-back-link">
          ← Past Papers
        </Link>
        <PastPaperBookmarkButton paperId={paper.id} />
      </div>

      <h1 className="title pp-detail-title">
        {paper.subject}
        {gradeLabel ? ` — ${gradeLabel}` : ""}
      </h1>

      <div className="pp-detail-meta-row">
        {metaParts.map((part) => (
          <span key={part} className="pp-badge">{part}</span>
        ))}
        <span className={`pp-memo-badge ${paper.memoStorageKey ? "pp-memo-available" : "pp-memo-pending"}`}>
          {paper.memoStorageKey ? "✓ Memo available" : "Memo not yet available"}
        </span>
      </div>

      <div className="pp-detail-actions">
        {splitViewerHref && (
          <div className="pp-action-group">
            <Link className="button btn-primary" href={splitViewerHref} style={{ background: "linear-gradient(135deg, #e8c15a, #e8c15a)" }}>
              ⚡ Open Split-Screen Mode (Paper + Memo)
            </Link>
          </div>
        )}

        <div className="pp-action-group">
          {paperViewerHref ? (
            <>
              <Link className="button" href={paperViewerHref}>
                ▶ View Paper Only
              </Link>
              <a className="button" href={`${paperUrl}?download=1`}>
                ↓ Download Paper
              </a>
            </>
          ) : (
            <span className="pp-badge pp-badge-muted">Paper file unavailable</span>
          )}
        </div>

        <div className="pp-action-group">
          {memoViewerHref ? (
            <>
              <Link className="button" href={memoViewerHref}>
                ▶ View Memo
              </Link>
              <a className="button" href={`${memoUrl}?download=1`}>
                ↓ Download Memo
              </a>
            </>
          ) : (
            <span className="pp-badge pp-badge-muted">Memo not yet available — we fetch it when DBE updates</span>
          )}
        </div>
      </div>

      <div className="pp-detail-attempt-bar">
        <Link className="button btn-primary" href={attemptHref}>
          Start timed attempt →
        </Link>
        <Link
          className="button"
          href={`/tutor?mode=hints&pastPaperId=${encodeURIComponent(paper.id)}&subject=${encodeURIComponent(paper.subject)}&grade=${paper.grade ?? ""}&q=${encodeURIComponent(`${paper.subject} ${gradeLabel} ${paper.year ?? ""} ${paper.session}`.trim())}`}
        >
          Get hints
        </Link>
        <Link
          className="button"
          href={`/tutor?mode=plan&pastPaperId=${encodeURIComponent(paper.id)}&subject=${encodeURIComponent(paper.subject)}&grade=${paper.grade ?? ""}`}
        >
          Plan this paper
        </Link>
        <Link
          className="button"
          href={`/tutor?mode=sitting&subject=${encodeURIComponent(paper.subject)}&grade=${paper.grade ?? ""}`}
        >
          Timed sitting
        </Link>
        {attemptStats.count > 0 && (
          <span className="pp-attempt-stats">
            {attemptStats.count} previous attempt{attemptStats.count !== 1 ? "s" : ""}
            {attemptStats.bestScore !== null
              ? ` — best ${Math.round(attemptStats.bestScore)}%`
              : ""}
          </span>
        )}
      </div>

      {paperUrl && storageKeyIsPdf(paper.paperStorageKey, paper.paperUrlOriginal) && (
        <div className="pp-detail-preview">
          <div className="pp-preview-label">Preview</div>
          <div className="pp-preview-frame">
            <iframe
              title={`${paper.subject} preview`}
              src={paperUrl}
              style={{ width: "100%", height: "420px", border: "none" }}
            />
          </div>
          {paperViewerHref && (
            <Link className="pp-preview-expand" href={paperViewerHref}>
              View full paper →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
