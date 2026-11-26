import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  try {
    // Logic: Find students in the same institution with higher XP (Seniors)
    // or students with weakness signals in subjects you are strong in.
    
    const result = await queryPlannerDb<{ id: string; display_name: string; total_xp: number }>(
      `
        SELECT 
          u.id::text, u.email as display_name, COALESCE(SUM(l.amount), 0) as total_xp
        FROM users u
        LEFT JOIN user_xp_ledger l ON l.user_id = u.id
        WHERE u.id != $1
        GROUP BY u.id
        ORDER BY total_xp DESC
        LIMIT 3
      `,
      [userId]
    );

    const mentors = result.rows.map(r => ({
      id: r.id,
      name: r.display_name.split('@')[0],
      xp: r.total_xp,
      role: "Potential Mentor",
    }));

    return NextResponse.json({ mentors });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
