import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb, withPlannerDbClient } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const discover = request.nextUrl.searchParams.get("discover") === "true";

  try {
    if (discover) {
      const result = await queryPlannerDb<{
        id: string; name: string; module_code: string | null;
        description: string | null; member_count: string; invite_code: string; is_member: boolean;
      }>(
        `SELECT
           c.id::text, c.name, c.module_code, c.description, c.invite_code,
           COUNT(m.user_id)::text AS member_count,
           EXISTS(SELECT 1 FROM study_circle_members sm WHERE sm.circle_id = c.id AND sm.user_id = $1) AS is_member
         FROM study_circles c
         INNER JOIN study_circle_members m ON m.circle_id = c.id
         WHERE c.is_public = TRUE
         GROUP BY c.id
         ORDER BY COUNT(m.user_id) DESC
         LIMIT 30`,
        [userId]
      );
      return NextResponse.json({ circles: result.rows });
    }

    const result = await queryPlannerDb<{
      id: string; name: string; module_code: string | null;
      description: string | null; member_count: string; invite_code: string;
    }>(
      `SELECT
         c.id::text, c.name, c.module_code, c.description, c.invite_code,
         COUNT(m.user_id)::text AS member_count
       FROM study_circles c
       INNER JOIN study_circle_members m ON m.circle_id = c.id
       WHERE c.id IN (SELECT circle_id FROM study_circle_members WHERE user_id = $1)
       GROUP BY c.id
       ORDER BY c.name`,
      [userId]
    );
    return NextResponse.json({ circles: result.rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const body = (await request.json()) as { name?: string; moduleCode?: string; description?: string; isPublic?: boolean };
  const { name, moduleCode, description, isPublic = true } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  try {
    const circle = await withPlannerDbClient(async (client) => {
      await client.query("BEGIN");

      const createRes = await client.query<{ id: string; invite_code: string }>(
        `INSERT INTO study_circles (name, module_code, description, is_public, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING id::text, invite_code`,
        [name.trim(), moduleCode ?? null, description?.trim() ?? null, isPublic, userId]
      );
      const { id: circleId, invite_code } = createRes.rows[0];

      await client.query(
        `INSERT INTO study_circle_members (circle_id, user_id) VALUES ($1, $2)`,
        [circleId, userId]
      );

      await client.query("COMMIT");
      return { id: circleId, name, moduleCode, description, isPublic, invite_code };
    });

    return NextResponse.json({ circle }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
