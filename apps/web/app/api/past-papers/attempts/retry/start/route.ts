import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/pastPapers/db";
import { getUserContextFromRequest } from "@/lib/pastPapers/auth";

export async function POST(request: NextRequest) {
  const { userId } = await getUserContextFromRequest();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parentAttemptId = body && typeof body.parentAttemptId === "string" ? body.parentAttemptId : null;
  const questionIds = body && Array.isArray(body.questionIds)
    ? body.questionIds.filter((id: unknown): id is string => typeof id === "string").slice(0, 10)
    : [];
  if (!parentAttemptId || questionIds.length === 0) {
    return NextResponse.json({ error: "Missing parentAttemptId or questionIds" }, { status: 400 });
  }

  const parent = (await db.findFirst("PastPaperAttempt", { where: { id: parentAttemptId } })) as {
    id: string;
    userId: string;
    status: string;
    pastPaperId: string;
    classId: string | null;
  } | null;
  if (!parent || parent.userId !== userId || parent.status !== "marked") {
    return NextResponse.json({ error: "Marked parent attempt not found" }, { status: 404 });
  }

  const paperQuestions = await db.findMany("PastPaperQuestion", {
    where: { pastPaperId: parent.pastPaperId },
    orderBy: { orderIndex: "asc" },
  });
  const allowedIds = new Set((paperQuestions as Array<{ id: string }>).map((question) => question.id));
  const selectedIds = questionIds.filter((id: string) => allowedIds.has(id));
  if (selectedIds.length === 0) {
    return NextResponse.json({ error: "Retry questions are not part of this paper" }, { status: 400 });
  }

  const retry = await db.create("PastPaperAttempt", {
    userId,
    classId: parent.classId ?? null,
    pastPaperId: parent.pastPaperId,
    status: "retry_in_progress",
    analyticsJson: JSON.stringify({
      retry: {
        parentAttemptId,
        questionIds: selectedIds,
        startedAt: new Date().toISOString(),
      },
    }),
  });

  return NextResponse.json({ attemptId: retry.id, questionIds: selectedIds });
}
