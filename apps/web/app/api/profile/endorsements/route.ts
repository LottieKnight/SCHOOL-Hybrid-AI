import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const result = await queryPlannerDb<{
    skill_label: string; count: string; has_endorsed_by_me: boolean;
  }>(
    `SELECT
       skill_label,
       COUNT(*)::text AS count,
       BOOL_OR(endorser_id = $2) AS has_endorsed_by_me
     FROM endorsements
     WHERE endorsee_id = $1
     GROUP BY skill_label
     ORDER BY COUNT(*) DESC`,
    [userId, session.user.id]
  );

  return NextResponse.json({ endorsements: result.rows });
}

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const endorserId = session.user.id;
  const body = (await request.json()) as { endorseeId?: string; skill?: string };
  const { endorseeId, skill } = body;

  if (!endorseeId || !skill?.trim()) {
    return NextResponse.json({ error: "endorseeId and skill are required" }, { status: 400 });
  }
  if (endorseeId === endorserId) {
    return NextResponse.json({ error: "You cannot endorse yourself." }, { status: 400 });
  }
  if (skill.length < 2 || skill.length > 60) {
    return NextResponse.json({ error: "Skill label must be 2–60 characters." }, { status: 400 });
  }

  // Enforce max 3 unique skills endorsed per endorser-per-endorsee
  const capCheck = await queryPlannerDb<{ count: string }>(
    `SELECT COUNT(DISTINCT skill_label)::text AS count FROM endorsements WHERE endorser_id = $1 AND endorsee_id = $2`,
    [endorserId, endorseeId]
  );
  if (parseInt(capCheck.rows[0]?.count ?? "0", 10) >= 3) {
    return NextResponse.json({ error: "You have already endorsed 3 skills for this person." }, { status: 409 });
  }

  try {
    await queryPlannerDb(
      `INSERT INTO endorsements (endorser_id, endorsee_id, skill_label) VALUES ($1, $2, $3)
       ON CONFLICT (endorser_id, endorsee_id, skill_label) DO NOTHING`,
      [endorserId, endorseeId, skill.trim()]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
