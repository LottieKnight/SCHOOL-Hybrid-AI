import { NextRequest, NextResponse } from "next/server";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const gameType = searchParams.get("game") ?? "exam_dash";
  const period = searchParams.get("period") ?? "daily";

  let dateFilter = "";
  if (period === "daily") dateFilter = "AND played_at >= date_trunc('day', NOW())";
  else if (period === "weekly") dateFilter = "AND played_at >= date_trunc('week', NOW())";

  try {
    const result = await queryPlannerDb<{ rank: string; user_id: string; score: string; metadata: any }>(
      `
        SELECT
          RANK() OVER (ORDER BY score DESC) as rank,
          user_id::text,
          score,
          metadata
        FROM game_scores
        WHERE game_type = $1 ${dateFilter}
        ORDER BY score DESC
        LIMIT 10
      `,
      [gameType]
    );

    const leaderboard = result.rows.map((row) => ({
      rank: parseInt(row.rank, 10),
      userId: row.user_id,
      displayName: `Scholar ${row.user_id.slice(0, 4).toUpperCase()}`,
      score: row.score,
      metadata: row.metadata,
    }));

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error("Failed to fetch game leaderboard:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
