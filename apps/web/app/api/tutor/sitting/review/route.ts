import { NextRequest, NextResponse } from "next/server";
import { resolveTutorUserId } from "@/lib/tutor/identity";
import { recordSittingReview } from "@/lib/tutor/persist";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await resolveTutorUserId();
  if (!user.userId) return NextResponse.json({ error: "Start a tutor session first." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.attemptId !== "string" || typeof body.questionId !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  try {
    const saved = await recordSittingReview({
      userId: user.userId,
      attemptId: body.attemptId,
      questionId: body.questionId,
      answerText: typeof body.answer === "string" ? body.answer : "",
      score: Number(body.score) || 0,
      outOf: Number(body.outOf) || 1,
      feedback: typeof body.feedback === "string" ? body.feedback : "",
      missedSteps: Array.isArray(body.missedSteps) ? body.missedSteps.filter((item: unknown) => typeof item === "string") : [],
      topic: typeof body.topic === "string" ? body.topic : "This question",
      subject: typeof body.subject === "string" ? body.subject : "CAPS",
      questionLabel: typeof body.questionLabel === "string" ? body.questionLabel : "Question",
      done: Boolean(body.done),
    });
    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save the review." }, { status: 500 });
  }
}
