import { NextRequest, NextResponse } from "next/server";
import { resolveTutorUserId } from "@/lib/tutor/identity";
import { recordMarkedAnswer } from "@/lib/tutor/persist";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await resolveTutorUserId();
  if (!user.userId) return NextResponse.json({ error: "Start a tutor session first." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const answer = typeof body.answer === "string" ? body.answer : "";
  const subject = typeof body.subject === "string" && body.subject.trim() ? body.subject.trim() : "CAPS";
  if (!question || !answer.trim()) return NextResponse.json({ error: "Question and answer are required." }, { status: 400 });
  const score = Number(body.score);
  const outOf = Number(body.outOf ?? body.marks);
  if (!Number.isFinite(score) || !Number.isFinite(outOf)) {
    return NextResponse.json({ error: "Score is required." }, { status: 400 });
  }
  const missed = Array.isArray(body.missedSteps) ? body.missedSteps.filter((item: unknown) => typeof item === "string") : [];
  try {
    const saved = await recordMarkedAnswer({
      userId: user.userId,
      pastPaperId: typeof body.pastPaperId === "string" ? body.pastPaperId : null,
      subject,
      grade: Number.isFinite(Number(body.grade)) ? Number(body.grade) : null,
      questionLabel: question,
      maxMarks: Number(body.marks) || outOf,
      answerText: answer,
      score,
      outOf,
      feedback: typeof body.feedback === "string" ? body.feedback : "",
      missedSteps: missed,
      topic: typeof body.topic === "string" ? body.topic : subject,
    });
    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save the mark." }, { status: 500 });
  }
}
