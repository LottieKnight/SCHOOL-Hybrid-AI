import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/pastPapers/db";
import { getPastPaperById } from "@/lib/pastPapers/catalog";
import { getStorageProvider } from "@/lib/storage";
import { PastPaperStartClient } from "@/components/PastPaperStartClient";
import { PastPapersLiveClient } from "@/components/PastPapersLiveClient";
import { pastPapersOpsLog } from "@/lib/pastPapers/opsLogger";
import { getUserIdFromRequest } from "@/lib/pastPapers/auth";
import {
  DETAILED_REPORT_CREDIT_COST,
  parseAttemptAnalytics,
  resolvePastPaperAttemptAccess,
  sanitizeAnalyticsForClient,
} from "@/lib/pastPapers/entitlements";

export const runtime = "nodejs";

type AttemptAnswerRow = {
  questionId: string;
  answerText: string | null;
  attachmentsJson: string | null;
  autoScore: number | null;
  reviewerScore: number | null;
  maxMarks: number | null;
  feedback: string | null;
};

async function safeGetSignedUrl(
  key: string | null,
  context: string,
  fallback: string | null = null,
): Promise<string | null> {
  if (!key) return fallback;
  const provider = getStorageProvider();
  try {
    const url = await provider.getSignedUrl(key);
    if (url.startsWith("/past-papers/")) return fallback ?? url;
    return url;
  } catch (error) {
    pastPapersOpsLog("error", "storage.signed_url.live_failed", {
      key,
      context,
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

export default async function StandalonePastPaperAttemptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attempt?: string }>;
}) {
  const { id } = await params;
  const { attempt: attemptId } = await searchParams;

  const paper = await getPastPaperById(id);
  if (!paper) notFound();

  const viewerUserId = await getUserIdFromRequest();
  const liveHref = `/past-papers/${paper.id}/attempt`;
  const backHref = `/past-papers/${paper.id}`;

  const [paperUrl, memoUrl] = await Promise.all([
    safeGetSignedUrl(paper.paperStorageKey, "paper-live.paper", paper.paperUrlOriginal ?? null),
    safeGetSignedUrl(paper.memoStorageKey, "paper-live.memo", paper.memoUrlOriginal ?? null),
  ]);

  if (!attemptId) {
    return (
      <section className="card glass">
        <Link href={backHref} className="pp-back-link">← Back to Paper</Link>
        <h1 className="title">Start a live attempt</h1>
        <p className="subtitle">Create a new attempt before entering the live workspace.</p>
        <PastPaperStartClient classId="" pastPaperId={paper.id} liveHref={liveHref} />
      </section>
    );
  }

  const attempt = await db.findFirst("PastPaperAttempt", {
    where: { id: attemptId },
    include: [
      { as: "answers", table: "PastPaperAnswer", localKey: "id", foreignKey: "attemptId", kind: "many" },
    ],
  });

  if (!attempt || attempt.pastPaperId !== paper.id) {
    return (
      <section className="card glass">
        <Link href={backHref} className="pp-back-link">← Back to Paper</Link>
        <h1 className="title">Attempt not found</h1>
        <p className="subtitle">Start a new attempt to continue.</p>
        <PastPaperStartClient classId="" pastPaperId={paper.id} liveHref={liveHref} />
      </section>
    );
  }

  const analytics = parseAttemptAnalytics(attempt.analyticsJson as string | null);
  const access = resolvePastPaperAttemptAccess({
    viewerUserId,
    attemptUserId: attempt.userId as string,
    analytics,
  });

  if (!access.canViewAttempt) {
    return (
      <section className="card glass">
        <h1 className="title">Attempt not found</h1>
        <p className="subtitle">Start a new attempt to continue.</p>
        <PastPaperStartClient classId="" pastPaperId={paper.id} liveHref={liveHref} />
      </section>
    );
  }

  const questions = (await db.findMany("PastPaperQuestion", {
    where: { pastPaperId: paper.id },
    orderBy: { orderIndex: "asc" },
  })) as unknown as import("@prisma/client").PastPaperQuestion[];

  const initialAnswers = (attempt.answers as unknown as AttemptAnswerRow[]).map((answer) => ({
    questionId: answer.questionId,
    answerText: answer.answerText ?? "",
    notes: answer.attachmentsJson ? (JSON.parse(answer.attachmentsJson) as { notes?: string }).notes ?? "" : "",
    autoScore: answer.autoScore,
    reviewerScore: answer.reviewerScore,
    maxMarks: answer.maxMarks,
    feedback: answer.feedback,
  }));

  const analyticsForClient = sanitizeAnalyticsForClient(analytics, access.detailedReportUnlocked);

  return (
    <PastPapersLiveClient
      attemptId={attempt.id as string}
      classId=""
      paper={{
        id: paper.id,
        title: paper.title,
        paperNumber: paper.paperNumber,
        language: paper.language,
        province: paper.province,
        grade: paper.grade ?? 0,
        subject: paper.subject,
        year: paper.year ?? 0,
        session: paper.session,
        paperUrlOriginal: paper.paperUrlOriginal,
        memoUrlOriginal: paper.memoUrlOriginal,
      }}
      questions={questions}
      initialAnswers={initialAnswers}
      paperUrl={paperUrl}
      memoUrl={memoUrl}
      attemptStatus={attempt.status as string}
      totalScore={attempt.totalScore as number | null}
      totalMax={attempt.totalMax as number | null}
      analytics={analyticsForClient}
      detailedReportUnlocked={access.detailedReportUnlocked}
      detailedReportCreditCost={DETAILED_REPORT_CREDIT_COST}
    />
  );
}
