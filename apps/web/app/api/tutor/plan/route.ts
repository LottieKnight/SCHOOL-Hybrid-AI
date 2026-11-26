import { NextRequest, NextResponse } from "next/server";
import { resolveTutorUserId } from "@/lib/tutor/identity";
import { recordPaperPlan } from "@/lib/tutor/persist";
import { normalizePlan } from "@/lib/hybridTutor/parse";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await resolveTutorUserId();
  if (!user.userId) return NextResponse.json({ error: "Start a tutor session first." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !body.plan) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const days = Number(body.days) || 7;
  try {
    const plan = normalizePlan(body.plan, days);
    const saved = await recordPaperPlan({
      userId: user.userId,
      pastPaperId: typeof body.pastPaperId === "string" ? body.pastPaperId : null,
      subject: typeof body.subject === "string" ? body.subject : plan.subject,
      grade: Number.isFinite(Number(body.grade)) ? Number(body.grade) : null,
      plan,
    });
    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save the plan." }, { status: 500 });
  }
}
