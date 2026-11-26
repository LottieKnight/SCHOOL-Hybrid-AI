import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const circleRes = await queryPlannerDb<{
      id: string; name: string; module_code: string | null;
      description: string | null; is_public: boolean; invite_code: string; max_members: number;
      member_count: string; created_by: string;
    }>(
      `SELECT c.id::text, c.name, c.module_code, c.description, c.is_public, c.invite_code, c.max_members,
              COUNT(m.user_id)::text AS member_count, c.created_by::text
       FROM study_circles c
       LEFT JOIN study_circle_members m ON m.circle_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [id]
    );

    if (!circleRes.rows.length) {
      return NextResponse.json({ error: "Circle not found." }, { status: 404 });
    }

    const circle = circleRes.rows[0];

    const membersRes = await queryPlannerDb<{
      user_id: string; username: string | null; avatar_uniform: unknown; joined_at: string;
    }>(
      `SELECT m.user_id::text, p.username, p.avatar_uniform, m.joined_at
       FROM study_circle_members m
       LEFT JOIN user_profiles p ON p.user_id = m.user_id
       WHERE m.circle_id = $1
       ORDER BY m.joined_at ASC
       LIMIT 20`,
      [id]
    );

    const viewerId = session.user?.id ?? "";
    const isMember = membersRes.rows.some((r) => r.user_id === viewerId);
    const isOwner = circle.created_by === viewerId;

    return NextResponse.json({
      circle,
      members: membersRes.rows,
      isMember,
      isOwner,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
