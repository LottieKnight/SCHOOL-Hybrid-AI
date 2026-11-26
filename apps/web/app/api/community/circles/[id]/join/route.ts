import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = session.user.id;

  const circleRes = await queryPlannerDb<{
    id: string; is_public: boolean; invite_code: string; max_members: number; member_count: string;
  }>(
    `SELECT c.id::text, c.is_public, c.invite_code, c.max_members, COUNT(m.user_id)::text AS member_count
     FROM study_circles c
     LEFT JOIN study_circle_members m ON m.circle_id = c.id
     WHERE c.id = $1 GROUP BY c.id`,
    [id]
  );

  if (!circleRes.rows.length) {
    return NextResponse.json({ error: "Circle not found." }, { status: 404 });
  }

  const circle = circleRes.rows[0];

  if (parseInt(circle.member_count, 10) >= circle.max_members) {
    return NextResponse.json({ error: "This circle is full (max 20 members)." }, { status: 409 });
  }

  // For private circles, check invite code
  if (!circle.is_public) {
    const body = (await request.json().catch(() => ({}))) as { inviteCode?: string };
    if (body.inviteCode !== circle.invite_code) {
      return NextResponse.json({ error: "Invalid invite code." }, { status: 403 });
    }
  }

  try {
    await queryPlannerDb(
      `INSERT INTO study_circle_members (circle_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, userId]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
