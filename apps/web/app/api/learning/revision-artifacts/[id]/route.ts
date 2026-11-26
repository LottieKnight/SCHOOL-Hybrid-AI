import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/pastPapers/db";
import { getUserContextFromRequest } from "@/lib/pastPapers/auth";
import { ensureLearningArtifactTables } from "@/lib/learning/schema";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { userId } = await getUserContextFromRequest();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureLearningArtifactTables();
  const { id } = await context.params;
  const artifact = await db.findFirst("RevisionArtifact", { where: { id, userId } });
  if (!artifact) return NextResponse.json({ error: "Revision artifact not found" }, { status: 404 });
  return NextResponse.json({ artifact: serializeArtifact(artifact) });
}

export async function PATCH(request: NextRequest, context: Context) {
  const { userId } = await getUserContextFromRequest();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureLearningArtifactTables();
  const { id } = await context.params;
  const existing = await db.findFirst("RevisionArtifact", { where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Revision artifact not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const nextStatus = body?.status === "archived" || body?.status === "saved" ? body.status : null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 180) : null;
  if (!nextStatus && !title) return NextResponse.json({ error: "Provide a valid status or title" }, { status: 400 });
  const updates: Record<string, string> = {};
  if (nextStatus) updates.status = nextStatus;
  if (title) updates.title = title;
  await db.update("RevisionArtifact", { id, userId }, updates);
  const updated = await db.findFirst("RevisionArtifact", { where: { id, userId } });
  return NextResponse.json({ artifact: updated ? serializeArtifact(updated) : null });
}

export async function DELETE(_request: NextRequest, context: Context) {
  const { userId } = await getUserContextFromRequest();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureLearningArtifactTables();
  const { id } = await context.params;
  const existing = await db.findFirst("RevisionArtifact", { where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Revision artifact not found" }, { status: 404 });
  await db.delete("RevisionArtifact", { id, userId });
  return NextResponse.json({ ok: true });
}

function serializeArtifact(row: Record<string, unknown>) {
  let evidence: unknown[] = [];
  try { evidence = row.evidenceJson ? JSON.parse(String(row.evidenceJson)) : []; } catch { evidence = []; }
  return { ...row, evidenceJson: undefined, evidence };
}
