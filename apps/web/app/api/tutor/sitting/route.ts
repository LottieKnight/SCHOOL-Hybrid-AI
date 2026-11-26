import { NextRequest, NextResponse } from "next/server";
import { resolveTutorUserId } from "@/lib/tutor/identity";
import { buildWeightedSitting } from "@/lib/tutor/persist";
import type { WeakSignal } from "@/lib/hybridTutor/sitting";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await resolveTutorUserId();
  if (!user.userId) return NextResponse.json({ error: "Start a tutor session first." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const minutes = Math.max(5, Math.min(180, Number(body?.minutes) || 25));
  const limit = Math.max(1, Math.min(8, Number(body?.limit) || 4));
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const gradeNumber = Number(body?.grade);
  const grade = Number.isInteger(gradeNumber) && gradeNumber >= 10 && gradeNumber <= 12 ? gradeNumber : null;
  const weak: WeakSignal[] = Array.isArray(body?.weak)
    ? body.weak
        .filter((item: unknown) => item && typeof item === "object")
        .map((item: { topic?: unknown; subject?: unknown; mastery?: unknown }) => ({
          topic: typeof item.topic === "string" ? item.topic : "",
          subject: typeof item.subject === "string" ? item.subject : undefined,
          mastery: Number.isFinite(Number(item.mastery)) ? Number(item.mastery) : 40,
        }))
        .filter((item: WeakSignal) => item.topic || item.subject)
    : [];
  try {
    const sitting = await buildWeightedSitting({
      userId: user.userId,
      minutes,
      limit,
      weak,
      subject: subject || null,
      grade,
    });
    return NextResponse.json(sitting);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start a sitting." }, { status: 500 });
  }
}
