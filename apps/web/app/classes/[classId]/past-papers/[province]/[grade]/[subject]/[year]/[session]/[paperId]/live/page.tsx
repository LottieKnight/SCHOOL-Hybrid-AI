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

function formatGrade(grade: number) {
  return grade === 0 ? "R" : String(grade);
}

async function safeGetSignedUrl(key: string | null, context: string) {
  if (!key) return null;
  const provider = getStorageProvider();
  try {
    return await provider.getSignedUrl(key);
  } catch (error) {
    pastPapersOpsLog("error", "storage.signed_url.live_failed", {
      key,
      context,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export default async function PastPaperLivePage({
  params,
  searchParams,
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
  searchParams: Promise<{ attempt?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const province = decodeURIComponent(resolvedParams.province);
  const gradeNumber = Number(resolvedParams.grade);
  const subject = decodeURIComponent(resolvedParams.subject);
  const yearNumber = Number(resolvedParams.year);
  const session = decodeURIComponent(resolvedParams.session);
  const attemptId =
    typeof resolvedSearchParams.attempt === "string" ? resolvedSearchParams.attempt : null;
  const viewerUserId = await getUserIdFromRequest();

  const paper = await getPastPaperById(resolvedParams.paperId);
  if (!paper) {
    notFound();
  }

  if (
    paper.grade === null ||
    paper.year === null ||
    paper.province !== province ||
    paper.grade !== gradeNumber ||
    paper.subject !== subject ||
    paper.year !== yearNumber ||
    paper.session !== session
  ) {
    notFound();
  }

  const paperUrl = await safeGetSignedUrl(paper.paperStorageKey, "paper-live.paper");
  const memoUrl = await safeGetSignedUrl(paper.memoStorageKey, "paper-live.memo");
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

  if (!attemptId) {
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
        <h1 className="title">Start a live attempt</h1>
        <p className="subtitle">Create a new attempt before entering the live workspace.</p>
        <PastPaperStartClient
          classId={resolvedParams.classId}
          pastPaperId={paper.id}
          liveHref={liveHref}
        />
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
        <h1 className="title">Attempt not found</h1>
        <p className="subtitle">Start a new attempt to continue.</p>
        <PastPaperStartClient
          classId={resolvedParams.classId}
          pastPaperId={paper.id}
          liveHref={liveHref}
        />
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
        <PastPaperStartClient
          classId={resolvedParams.classId}
          pastPaperId={paper.id}
          liveHref={liveHref}
        />
      </section>
    );
  }

  const questions = (await db.findMany("PastPaperQuestion", {
    where: { pastPaperId: paper.id },
    orderBy: { orderIndex: "asc" },
  })) as unknown as import("@prisma/client").PastPaperQuestion[];

  const initialAnswers = (attempt.answers as unknown as Array<{
    questionId: string;
    answerText: string | null;
    attachmentsJson: string | null;
    autoScore: number | null;
    reviewerScore: number | null;
    maxMarks: number | null;
    feedback: string | null;
  }>).map((answer) => ({
    questionId: answer.questionId,
    answerText: answer.answerText ?? "",
    notes: answer.attachmentsJson ? JSON.parse(answer.attachmentsJson).notes || "" : "",
    autoScore: answer.autoScore,
    reviewerScore: answer.reviewerScore,
    maxMarks: answer.maxMarks,
    feedback: answer.feedback,
  }));

  const analyticsForClient = sanitizeAnalyticsForClient(
    analytics,
    access.detailedReportUnlocked
  );

  return (
    <PastPapersLiveClient
      attemptId={attempt.id as string}
      classId={resolvedParams.classId}
      paper={{
        id: paper.id,
        title: paper.title,
        paperNumber: paper.paperNumber,
        language: paper.language,
        province: paper.province,
        grade: paper.grade,
        subject: paper.subject,
        year: paper.year,
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
