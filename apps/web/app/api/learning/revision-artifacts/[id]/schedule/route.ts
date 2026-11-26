import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/pastPapers/db";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";
import { ensureLearningArtifactTables } from "@/lib/learning/schema";

type Context = { params: Promise<{ id: string }> };

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

export async function POST(request: NextRequest, context: Context) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  await ensureLearningArtifactTables();
  const artifact = await db.findFirst("RevisionArtifact", { where: { id, userId } });
  if (!artifact) return NextResponse.json({ error: "Revision artifact not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const eventDate = body?.eventDate;
  if (!isIsoDate(eventDate)) return NextResponse.json({ error: "Choose a valid study date." }, { status: 400 });
  const parsed = new Date(`${eventDate}T00:00:00Z`);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  if (parsed < today) return NextResponse.json({ error: "Study tasks must be scheduled for today or later." }, { status: 400 });

  const existing = await queryPlannerDb<{ id: string; event_date: string }>(
    `SELECT id::text AS id, event_date::text AS event_date FROM student_planner_events WHERE student_id = $1 AND source_ref_id = $2 AND source_table = 'revision_artifacts' AND is_dismissed = FALSE LIMIT 1`,
    [userId, id]
  );
  if (existing.rowCount > 0) {
    await db.update("RevisionArtifact", { id, userId }, { plannerStatus: "scheduled", plannerEventId: existing.rows[0].id, plannerCompletedAt: null, plannerSkippedAt: null });
    return NextResponse.json({ scheduled: true, alreadyScheduled: true, status: "scheduled", event: existing.rows[0] });
  }

  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim().slice(0, 180) : String(artifact.title);
  const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim().slice(0, 600) : String(artifact.body).slice(0, 600);
  const result = await queryPlannerDb<{ id: string; event_date: string; title: string }>(
    `INSERT INTO student_planner_events (student_id, title, description, event_date, event_type, tier, source_ref_id, source_table, is_manual) VALUES ($1, $2, $3, $4, 'personal', 'manual', $5, 'revision_artifacts', TRUE) RETURNING id::text AS id, event_date::text AS event_date, title`,
    [userId, title, description, eventDate, id]
  );
  await db.update("RevisionArtifact", { id, userId }, { plannerStatus: "scheduled", plannerEventId: result.rows[0].id, plannerCompletedAt: null, plannerSkippedAt: null });
  return NextResponse.json({ scheduled: true, alreadyScheduled: false, status: "scheduled", event: result.rows[0] }, { status: 201 });
}

export async function PATCH(request: NextRequest, context: Context) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  await ensureLearningArtifactTables();
  const artifact = await db.findFirst("RevisionArtifact", { where: { id, userId } });
  if (!artifact) return NextResponse.json({ error: "Revision artifact not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const nextStatus = body?.status === "completed" || body?.status === "skipped" || body?.status === "scheduled" ? body.status : null;
  if (!nextStatus) return NextResponse.json({ error: "Choose completed, skipped, or scheduled." }, { status: 400 });
  const eventId = artifact.plannerEventId ? String(artifact.plannerEventId) : "";
  if (!eventId) return NextResponse.json({ error: "This artifact has not been scheduled yet." }, { status: 409 });

  await queryPlannerDb(
    `UPDATE student_planner_events SET is_dismissed = $1 WHERE id = $2 AND student_id = $3 AND source_ref_id = $4 AND source_table = 'revision_artifacts'`,
    [nextStatus !== "scheduled", eventId, userId, id]
  );
  await db.update("RevisionArtifact", { id, userId }, {
    plannerStatus: nextStatus,
    plannerCompletedAt: nextStatus === "completed" ? new Date() : null,
    plannerSkippedAt: nextStatus === "skipped" ? new Date() : null,
  });
  const updated = await db.findFirst("RevisionArtifact", { where: { id, userId } });
  return NextResponse.json({ status: nextStatus, artifact: updated });
}
