import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/pastPapers/db";
import { getUserIdFromRequest } from "@/lib/pastPapers/auth";

type SaveAnswer = {
  questionId: string;
  answerText: string;
  notes?: string;
  timeSpentSeconds?: number;
};

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
  const answers = Array.isArray(body.answers) ? (body.answers as SaveAnswer[]) : [];
  if (!attemptId) {
    return NextResponse.json({ error: "Missing attemptId" }, { status: 400 });
  }

  const attempt = await db.findFirst("PastPaperAttempt", { where: { id: attemptId } });
  if (!attempt || attempt.userId !== userId) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }
  if (attempt.status !== "in_progress") {
    return NextResponse.json({ error: "Attempt is not editable" }, { status: 409 });
  }

  for (const answer of answers) {
    if (!answer.questionId) continue;
    const answerText = typeof answer.answerText === "string" ? answer.answerText : "";
    const notes = typeof answer.notes === "string" ? answer.notes : "";

    const existing = await db.findFirst("PastPaperAnswer", {
      where: { attemptId, questionId: answer.questionId },
      select: ["id"],
    });
    if (existing) {
      await db.update(
        "PastPaperAnswer",
        { id: existing.id as string },
        { answerText, attachmentsJson: JSON.stringify({ notes }) }
      );
    } else {
      await db.create("PastPaperAnswer", {
        attemptId,
        questionId: answer.questionId,
        answerText,
        attachmentsJson: JSON.stringify({ notes }),
      });
    }
  }

  const analytics = attempt.analyticsJson ? JSON.parse(attempt.analyticsJson as string) : {};
  const timeSpent = analytics.timeSpent || {};
  for (const answer of answers) {
    if (!answer.questionId || typeof answer.timeSpentSeconds !== "number") continue;
    timeSpent[answer.questionId] = (timeSpent[answer.questionId] || 0) + answer.timeSpentSeconds;
  }

  await db.update(
    "PastPaperAttempt",
    { id: attemptId },
    { analyticsJson: JSON.stringify({ ...analytics, timeSpent }) }
  );

  return NextResponse.json({ ok: true });
}
