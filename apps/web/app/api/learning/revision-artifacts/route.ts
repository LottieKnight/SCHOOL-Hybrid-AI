import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/pastPapers/db";
import { getUserContextFromRequest } from "@/lib/pastPapers/auth";
import { ensureLearningArtifactTables } from "@/lib/learning/schema";
import { captureLearningSession } from "@/lib/learning/capture";

export async function POST(request: NextRequest) {
  const { userId } = await getUserContextFromRequest();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const payload = body as Record<string, unknown>;
  const title = typeof payload.title === "string" ? payload.title.trim().slice(0, 180) : "";
  const kind = typeof payload.kind === "string" ? payload.kind.trim().slice(0, 60) : "targeted_retry";
  const summary = Array.isArray(payload.takeaways) ? payload.takeaways.filter((item): item is string => typeof item === "string").slice(0, 8) : [];
  const nextAction = typeof payload.nextAction === "string" ? payload.nextAction.trim().slice(0, 300) : "Review this concept again soon.";
  if (!title || summary.length === 0) return NextResponse.json({ error: "Title and takeaways are required" }, { status: 400 });

  const sourceType = typeof payload.sourceType === "string" ? payload.sourceType.slice(0, 80) : null;
  const sourceId = typeof payload.sourceId === "string" ? payload.sourceId.slice(0, 120) : null;
  const captured = await captureLearningSession({
    userId,
    kind,
    title,
    subject: typeof payload.subject === "string" ? payload.subject.slice(0, 120) : null,
    sourceType: sourceType || "manual_summary",
    sourceId: sourceId || "manual",
    takeaways: summary,
    nextAction,
    evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
  });

  return NextResponse.json({ ok: true, ...captured });
}

export async function GET(request: NextRequest) {
  const { userId } = await getUserContextFromRequest();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureLearningArtifactTables();
  const type = request.nextUrl.searchParams.get("type");
  const status = request.nextUrl.searchParams.get("status") || "saved";
  const where: Record<string, string> = { userId, status };
  if (type) where.artifactType = type;
  const artifacts = await db.findMany("RevisionArtifact", { where, orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ artifacts: artifacts.map(serializeArtifact) });
}

function serializeArtifact(row: Record<string, unknown>) {
  let evidence: unknown[] = [];
  try { evidence = row.evidenceJson ? JSON.parse(String(row.evidenceJson)) : []; } catch { evidence = []; }
  return { ...row, evidenceJson: undefined, evidence };
}
