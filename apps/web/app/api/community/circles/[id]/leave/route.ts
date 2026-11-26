import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = session.user.id;

  // Prevent the creator from leaving (they must delete the circle instead)
  const ownerCheck = await queryPlannerDb<{ created_by: string }>(
    `SELECT created_by::text FROM study_circles WHERE id = $1`,
    [id]
  );
  if (!ownerCheck.rows.length) {
    return NextResponse.json({ error: "Circle not found." }, { status: 404 });
  }
  if (ownerCheck.rows[0].created_by === userId) {
    return NextResponse.json({ error: "Circle owners cannot leave. Delete the circle instead." }, { status: 400 });
  }

  try {
    await queryPlannerDb(
      `DELETE FROM study_circle_members WHERE circle_id = $1 AND user_id = $2`,
      [id, userId]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
