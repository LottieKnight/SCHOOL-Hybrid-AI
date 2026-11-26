import Link from "next/link";
import { notFound } from "next/navigation";
import { getPastPaperWithSourceById } from "@/lib/pastPapers/catalog";
import { getStorageProvider } from "@/lib/storage";
import { PastPaperStartClient } from "@/components/PastPaperStartClient";
import { pastPapersOpsLog } from "@/lib/pastPapers/opsLogger";

export const runtime = "nodejs";

function formatGrade(grade: number) {
  return grade === 0 ? "R" : String(grade);
}

function buildViewerHref(classId: string, fileUrl: string, title: string, backPath: string) {
  const base = "/classes/" + encodeURIComponent(classId) + "/past-papers/viewer";
  const query =
    "?file=" +
    encodeURIComponent(fileUrl) +
    "&title=" +
    encodeURIComponent(title) +
    "&back=" +
    encodeURIComponent(backPath);
  return base + query;
}

async function safeGetSignedUrl(key: string | null, context: string) {
  if (!key) return null;
  const provider = getStorageProvider();
  try {
    return await provider.getSignedUrl(key);
  } catch (error) {
    pastPapersOpsLog("error", "storage.signed_url.page_failed", {
      key,
      context,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export default async function PastPaperDetailPage({
  params,
}: {
  params: Promise<{
    classId: string;
    province: string;
    grade: string;
    subject: string;
    year: string;
    session: string;
    paperId: string;
  }>;
}) {
  const resolvedParams = await params;
  const province = decodeURIComponent(resolvedParams.province);
  const gradeNumber = Number(resolvedParams.grade);
  const subject = decodeURIComponent(resolvedParams.subject);
  const yearNumber = Number(resolvedParams.year);
  const session = decodeURIComponent(resolvedParams.session);

  const paper = await getPastPaperWithSourceById(resolvedParams.paperId);
  if (!paper) {
    notFound();
  }

  if (
    paper.province !== province ||
    paper.grade !== gradeNumber ||
    paper.subject !== subject ||
    paper.year !== yearNumber ||
    paper.session !== session
  ) {
    notFound();
  }

  const paperUrl = await safeGetSignedUrl(paper.paperStorageKey, "paper-detail.paper");
  const memoUrl = await safeGetSignedUrl(paper.memoStorageKey, "paper-detail.memo");
  const liveHref =
    "/classes/" +
    resolvedParams.classId +
    "/past-papers/" +
    encodeURIComponent(province) +
    "/" +
    gradeNumber +
    "/" +
    encodeURIComponent(subject) +
    "/" +
    yearNumber +
    "/" +
    encodeURIComponent(session) +
    "/" +
    paper.id +
    "/live";
  const backPath =
    "/classes/" +
    resolvedParams.classId +
    "/past-papers/" +
    encodeURIComponent(province) +
    "/" +
    gradeNumber +
    "/" +
    encodeURIComponent(subject) +
    "/" +
    yearNumber +
    "/" +
    encodeURIComponent(session) +
    "/" +
    paper.id;
  const paperViewerHref = paperUrl
    ? buildViewerHref(resolvedParams.classId, paperUrl, paper.title + " (Paper)", backPath)
    : null;
  const memoViewerHref = memoUrl
    ? buildViewerHref(resolvedParams.classId, memoUrl, paper.title + " (Memo)", backPath)
    : null;

  return (
    <section className="card glass">
      <div className="crumbs">
        <Link href={"/classes/" + resolvedParams.classId + "/past-papers"}>Past Papers</Link>
        <span>/</span>
        <span>{province}</span>
        <span>/</span>
        <span>Grade {formatGrade(gradeNumber)}</span>
        <span>/</span>
        <span>{subject}</span>
        <span>/</span>
        <span>{yearNumber}</span>
        <span>/</span>
        <span>{session}</span>
      </div>
      <h1 className="title">{paper.title}</h1>
      <p className="subtitle">
        Paper {paper.paperNumber} - {paper.language.toUpperCase()}
      </p>
      <div className="outline-actions">
        {paperUrl && paperViewerHref ? (
          <>
            <Link className="button" href={paperViewerHref}>
              Open paper
            </Link>
            <a className="button" href={paperUrl + "?download=1"}>
              Download paper
            </a>
          </>
        ) : (
          <span className="badge">Paper file unavailable</span>
        )}
        {memoUrl && memoViewerHref ? (
          <>
            <Link className="button" href={memoViewerHref}>
              View memo
            </Link>
            <a className="button" href={memoUrl + "?download=1"}>
              Download memo
            </a>
          </>
        ) : (
          <span className="badge">Memo not available yet (we&apos;ll fetch it when DBE updates)</span>
        )}
      </div>
      <div className="list">
        <div className="list-item">
          <strong>Source Attribution</strong>
          <div className="badge">Source: {paper.source.name}</div>
          <div className="badge">Source base: {paper.source.baseUrl}</div>
          <div className="badge">Source page: {paper.sourcePageUrl || "Unavailable"}</div>
          <div className="badge">Original paper URL: {paper.paperUrlOriginal || "Unavailable"}</div>
          <div className="badge">Original memo URL: {paper.memoUrlOriginal || "Unavailable"}</div>
        </div>
      </div>
      <PastPaperStartClient classId={resolvedParams.classId} pastPaperId={paper.id} liveHref={liveHref} />
    </section>
  );
}
