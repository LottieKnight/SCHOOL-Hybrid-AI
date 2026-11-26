import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/pastPapers/db";
import { getUserContextFromRequest } from "@/lib/pastPapers/auth";
import { pastPapersLog } from "@/lib/pastPapers/logging";
import { ensurePastPaperQuestions } from "@/lib/pastPapers/questions";

export async function POST(request: NextRequest) {
  const userContext = await getUserContextFromRequest();
  const userId = userContext.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const classId = typeof body.classId === "string" && body.classId ? body.classId : null;
  const pastPaperId = typeof body.pastPaperId === "string" ? body.pastPaperId : null;
  if (!pastPaperId) {
    return NextResponse.json({ error: "Missing pastPaperId" }, { status: 400 });
  }

  pastPapersLog("attempt.start.user", {
    userId,
    source: userContext.source,
    classId,
    pastPaperId,
    environment: process.env.NODE_ENV,
  });

  const paper = await db.findFirst("PastPaper", { where: { id: pastPaperId } });
  if (!paper) {
    return NextResponse.json({ error: "Past paper not found" }, { status: 404 });
  }

  await ensurePastPaperQuestions(pastPaperId);

  const existing = await db.findFirst("PastPaperAttempt", {
    where: { userId, classId, pastPaperId, status: "in_progress" },
    orderBy: { createdAt: "desc" },
  });

  const attempt = existing
    ? existing
    : await db.create("PastPaperAttempt", {
        userId,
        classId,
        pastPaperId,
      });

  return NextResponse.json({ attemptId: attempt.id });
}
