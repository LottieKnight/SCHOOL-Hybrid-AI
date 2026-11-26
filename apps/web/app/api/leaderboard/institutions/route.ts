import { NextRequest, NextResponse } from "next/server";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const result = await queryPlannerDb<{ id: string; name: string; total_xp: string; student_count: string }>(
      `
        SELECT 
          i.id::text, i.name,
          COALESCE(SUM(l.amount), 0)::text AS total_xp,
          COUNT(DISTINCT u.id)::text AS student_count
        FROM institutions i
        LEFT JOIN users u ON u.institution_id = i.id
        LEFT JOIN user_xp_ledger l ON l.user_id = u.id
        GROUP BY i.id
        ORDER BY SUM(l.amount) DESC NULLS LAST
        LIMIT 10
      `,
      []
    );

    const leaderboard = result.rows.map((row, i) => ({
      rank: i + 1,
      name: row.name,
      xp: parseInt(row.total_xp ?? "0", 10),
      students: parseInt(row.student_count ?? "0", 10),
    }));

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Leaderboard unavailable", offline: true }, { status: 503 });
  }
}
