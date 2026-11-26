import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Aggregate weekly stats
    const xpResult = await queryPlannerDb<{ total_xp: string }>(
      `SELECT SUM(amount)::text AS total_xp FROM user_xp_ledger WHERE user_id = $1 AND created_at >= date_trunc('week', NOW())`,
      [userId]
    );

    const quizResult = await queryPlannerDb<{ count: string; avg_score: string }>(
      `SELECT COUNT(*)::text AS count, AVG(score_percent)::text AS avg_score FROM quiz_sessions WHERE user_id = $1 AND completed = TRUE AND quiz_date >= date_trunc('week', NOW())`,
      [userId]
    );

    const communityResult = await queryPlannerDb<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM posts WHERE user_id = $1 AND created_at >= date_trunc('week', NOW())`,
      [userId]
    );

    return NextResponse.json({
      weeklyXp: parseInt(xpResult.rows[0]?.total_xp ?? "0", 10),
      quizzesCompleted: parseInt(quizResult.rows[0]?.count ?? "0", 10),
      avgQuizScore: parseFloat(quizResult.rows[0]?.avg_score ?? "0"),
      postsCreated: parseInt(communityResult.rows[0]?.count ?? "0", 10),
    });
  } catch (error) {
    console.error("Failed to fetch weekly digest:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
