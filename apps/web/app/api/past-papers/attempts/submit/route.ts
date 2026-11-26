import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/pastPapers/db";
import { getUserIdFromRequest } from "@/lib/pastPapers/auth";
import { getStorageProvider } from "@/lib/storage";
import { promises as fs } from "node:fs";
import { computeDetailedReportValue } from "@/lib/pastPapers/reportValue";
import { captureLearningSession } from "@/lib/learning/capture";

export const runtime = "nodejs";

function tokenize(text: string) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4);
  return new Set(words);
}

function scoreAnswer(answerText: string, memoTokens: Set<string>, maxMarks: number) {
  if (!answerText.trim() || memoTokens.size === 0) return 0;
  const answerTokens = tokenize(answerText);
  if (answerTokens.size === 0) return 0;
  let matches = 0;
  for (const token of answerTokens) {
    if (memoTokens.has(token)) matches += 1;
  }
  const ratio = matches / answerTokens.size;
  return Math.max(0, Math.min(maxMarks, Math.round(ratio * maxMarks)));
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const attemptId = typeof body.attemptId === "string" ? body.attemptId : null;
  if (!attemptId) {
    return NextResponse.json({ error: "Missing attemptId" }, { status: 400 });
  }

  const attempt = await db.findFirst("PastPaperAttempt", {
    where: { id: attemptId },
    include: [
      { as: "pastPaper", table: "PastPaper", localKey: "pastPaperId", foreignKey: "id", kind: "one" },
      { as: "answers", table: "PastPaperAnswer", localKey: "id", foreignKey: "attemptId", kind: "many" },
    ],
  });
  if (!attempt || attempt.userId !== userId) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  const typedAttempt = attempt as {
    id: string;
    userId: string;
    pastPaperId: string;
    status: string;
    analyticsJson: string | null;
    pastPaper: { id: string; memoStorageKey: string | null };
    answers: Array<{ id: string; questionId: string; answerText: string }>;
  };

  const provider = getStorageProvider();
  let memoText = "";
  let memoSnippet = "";
  if (typedAttempt.pastPaper.memoStorageKey) {
    const memoPath = provider.getLocalPath ? provider.getLocalPath(typedAttempt.pastPaper.memoStorageKey) : null;
    if (memoPath) {
      try {
        const memoBuffer = await fs.readFile(memoPath);
        const pdfParseModule = await import("pdf-parse");
        const pdfParse = "default" in pdfParseModule ? pdfParseModule.default : (pdfParseModule as any);
        const parsed = await pdfParse(memoBuffer);
        memoText = parsed.text || "";
        memoSnippet = memoText.trim().slice(0, 400);
      } catch {
        memoText = "";
      }
    }
  }

  const memoTokens = tokenize(memoText);
  const questions = (await db.findMany("PastPaperQuestion", {
    where: { pastPaperId: typedAttempt.pastPaperId },
    orderBy: { orderIndex: "asc" },
  })) as Array<{
    id: string;
    qNumber: string;
    maxMarks: number | null;
    section: string | null;
    topicTags: string | null;
  }>;
  const existingAnalytics = attempt.analyticsJson ? JSON.parse(attempt.analyticsJson as string) : {};
  const retryMeta = existingAnalytics?.retry as { parentAttemptId?: string; questionIds?: string[] } | undefined;
  const selectedQuestionIds = retryMeta?.questionIds?.length ? new Set(retryMeta.questionIds) : null;
  const scoringQuestions = selectedQuestionIds
    ? questions.filter((question) => selectedQuestionIds.has(question.id))
    : questions;
  const previousMarkedAttempt = (await db.findFirst("PastPaperAttempt", {
    where: {
      userId,
      pastPaperId: typedAttempt.pastPaperId,
      status: "marked",
      id: retryMeta?.parentAttemptId || { not: typedAttempt.id },
    },
    orderBy: [{ markedAt: "desc" }, { updatedAt: "desc" }],
    select: ["id", "totalScore", "totalMax"],
  })) as { id: string; totalScore: number | null; totalMax: number | null } | null;

  let totalScore = 0;
  let totalMax = 0;
  const perQuestion: Record<string, any> = {};

  for (const question of scoringQuestions) {
    const maxMarks = question.maxMarks ?? 5;
    totalMax += maxMarks;

    const answer = typedAttempt.answers.find((a) => a.questionId === question.id);
    const answerText = answer?.answerText || "";
    const autoScore = memoText
      ? scoreAnswer(answerText, memoTokens, maxMarks)
      : answerText.trim()
      ? Math.min(1, maxMarks)
      : 0;

    totalScore += autoScore;
    perQuestion[question.id] = {
      questionId: question.id,
      qNumber: question.qNumber,
      score: autoScore,
      maxMarks,
      needsReview: memoText.length === 0 || answerText.trim().length >= 80,
    };

    if (answer) {
      await db.update(
      "PastPaperAnswer",
      { id: answer.id },
      { autoScore, maxMarks }
    );
    }
  }

  const detailedReportValue = computeDetailedReportValue({
    questions: scoringQuestions.map((question: (typeof questions)[number]) => ({
      id: question.id,
      qNumber: question.qNumber,
      maxMarks: question.maxMarks,
      section: question.section,
      topicTags: question.topicTags,
    })),
    perQuestion,
    totalScore,
    totalMax,
    previousAttempt: previousMarkedAttempt
      ? {
          id: previousMarkedAttempt.id,
          totalScore: previousMarkedAttempt.totalScore,
          totalMax: previousMarkedAttempt.totalMax,
        }
      : null,
  });
  const retryComparison = retryMeta?.parentAttemptId && previousMarkedAttempt
    ? {
        parentAttemptId: previousMarkedAttempt.id,
        originalScore: previousMarkedAttempt.totalScore,
        originalMax: previousMarkedAttempt.totalMax,
        retryScore: totalScore,
        retryMax: totalMax,
        originalPercent: previousMarkedAttempt.totalMax ? (Number(previousMarkedAttempt.totalScore ?? 0) / Number(previousMarkedAttempt.totalMax)) * 100 : null,
        retryPercent: totalMax ? (totalScore / totalMax) * 100 : null,
        deltaPercent: previousMarkedAttempt.totalMax && totalMax
          ? (totalScore / totalMax) * 100 - (Number(previousMarkedAttempt.totalScore ?? 0) / Number(previousMarkedAttempt.totalMax)) * 100
          : null,
      }
    : null;
  const mergedAnalytics = {
    ...existingAnalytics,
    perQuestion,
    memoSnippet,
    detailedReportValue,
    ...(retryComparison ? { retryComparison } : {}),
  };

  await db.update(
    "PastPaperAttempt",
    { id: attemptId },
    {
      status: "marked",
      submittedAt: new Date(),
      markedAt: new Date(),
      totalScore,
      totalMax,
      analyticsJson: JSON.stringify(mergedAnalytics),
    }
  );

  let learningCapture: { sessionId: string; artifactId: string } | null = null;
  if (!retryMeta?.parentAttemptId) {
    try {
      const missed = Object.values(perQuestion).filter((item: any) => Number(item.score || 0) < Number(item.maxMarks || 0)).length;
      learningCapture = await captureLearningSession({
        userId,
        kind: "past_paper",
        title: `Past paper · ${typedAttempt.pastPaperId}`,
        sourceType: "past_paper_attempt",
        sourceId: attemptId,
        takeaways: [
          `Scored ${totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0}% (${totalScore}/${totalMax} marks).`,
          missed > 0 ? `${missed} question${missed === 1 ? "" : "s"} need${missed === 1 ? "s" : ""} another look.` : "No missed questions were detected by the initial marking pass.",
        ],
        nextAction: missed > 0 ? "Open the detailed report and turn the weakest question into a focused retry." : "Review the memo once, then attempt a new paper to test transfer.",
        evidence: [{ type: "past_paper", label: `${totalScore}/${totalMax} marks` }, { type: "missed_questions", label: `${missed} missed question${missed === 1 ? "" : "s"}` }],
      });
    } catch {
      // Artifact capture is best-effort and must not block a marked paper result.
    }
  }

  return NextResponse.json({ ok: true, totalScore, totalMax, retryComparison, learningCapture });
}
