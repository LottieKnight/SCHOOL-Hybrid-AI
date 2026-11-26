import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/pastPapers/db";
import { getUserIdFromRequest } from "@/lib/pastPapers/auth";
import {
  isDetailedReportUnlocked,
  parseAttemptAnalytics,
} from "@/lib/pastPapers/entitlements";

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
  const questionId = typeof body.questionId === "string" ? body.questionId : null;
  const reviewerScore =
    typeof body.reviewerScore === "number" && Number.isFinite(body.reviewerScore) ? body.reviewerScore : null;
  const feedback = typeof body.feedback === "string" ? body.feedback : null;

  if (!attemptId || !questionId) {
    return NextResponse.json({ error: "Missing attemptId or questionId" }, { status: 400 });
  }

  const attempt = await db.findFirst("PastPaperAttempt", { where: { id: attemptId } });
  if (!attempt || attempt.userId !== userId) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  const analytics = parseAttemptAnalytics(attempt.analyticsJson as string | null);
  if (!isDetailedReportUnlocked(analytics)) {
    return NextResponse.json(
      { error: "Detailed report is locked for this attempt." },
      { status: 402 }
    );
  }

  const question = await db.findFirst("PastPaperQuestion", { where: { id: questionId } });
  if (!question || question.pastPaperId !== attempt.pastPaperId) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const maxMarks = (question.maxMarks as number | null) ?? 5;
  const boundedReviewerScore =
    reviewerScore != null ? Math.max(0, Math.min(maxMarks, reviewerScore)) : null;

  const existingAnswer = await db.findFirst("PastPaperAnswer", {
    where: { attemptId, questionId },
    select: ["id"],
  });
  if (existingAnswer) {
    await db.update(
      "PastPaperAnswer",
      { id: existingAnswer.id as string },
      { reviewerScore: boundedReviewerScore, feedback, maxMarks }
    );
  } else {
    await db.create("PastPaperAnswer", {
      attemptId,
      questionId,
      answerText: "",
      reviewerScore: boundedReviewerScore,
      feedback,
      maxMarks,
    });
  }

  const answers = (await db.findMany("PastPaperAnswer", {
    where: { attemptId },
  })) as Array<{
    maxMarks: number | null;
    reviewerScore: number | null;
    autoScore: number | null;
  }>;
  const totals = answers.reduce(
    (acc: { totalScore: number; totalMax: number }, answer) => {
      const max = answer.maxMarks ?? 0;
      const score = answer.reviewerScore ?? answer.autoScore ?? 0;
      acc.totalMax += max;
      acc.totalScore += score;
      return acc;
    },
    { totalScore: 0, totalMax: 0 }
  );

  await db.update(
    "PastPaperAttempt",
    { id: attemptId },
    { totalScore: totals.totalScore, totalMax: totals.totalMax, status: "marked", markedAt: new Date() }
  );

  return NextResponse.json({ ok: true, totalScore: totals.totalScore, totalMax: totals.totalMax });
}
