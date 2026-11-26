import { redis } from "@/lib/redis";
import { queryPlannerDb } from "@/lib/server/plannerDb";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEADERBOARD_CACHE_KEY = "leaderboard:weekly";
const LEADERBOARD_CACHE_TTL = 300; // 5 minutes — staleness acceptable for a leaderboard

export async function GET(request: NextRequest) {
  if (redis) {
    try {
      const cached = await redis.get(LEADERBOARD_CACHE_KEY);
      if (cached) {
        return NextResponse.json(JSON.parse(cached), { headers: { "X-Cache": "HIT" } });
      }
    } catch { /* fall through to DB */ }
  }

  try {
    const weeklyQuery = `
      SELECT
        user_id::text,
        SUM(amount)::text AS weekly_xp
      FROM user_xp_ledger
      WHERE created_at >= date_trunc('week', NOW())
      GROUP BY user_id
      ORDER BY SUM(amount) DESC
      LIMIT 10
    `;
    const fallbackQuery = `
      SELECT
        user_id::text,
        SUM(amount)::text AS weekly_xp
      FROM user_xp_ledger
      GROUP BY user_id
      ORDER BY SUM(amount) DESC
      LIMIT 10
    `;

    let result;
    try {
      result = await queryPlannerDb<{ user_id: string; weekly_xp: string }>(weeklyQuery, []);
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code ?? "") : "";
      const message = error instanceof Error ? error.message : String(error);
      if (code === "42703" && message.includes("created_at")) {
        result = await queryPlannerDb<{ user_id: string; weekly_xp: string }>(fallbackQuery, []);
      } else {
        throw error;
      }
    }

    const leaderboard = result.rows.map((row, i) => ({
      rank: i + 1,
      displayName: `Scholar ${row.user_id.slice(0, 4).toUpperCase()}`,
      xp: parseInt(row.weekly_xp ?? "0", 10),
    }));

    const payload = { leaderboard };

    if (redis) {
      try { await redis.setex(LEADERBOARD_CACHE_KEY, LEADERBOARD_CACHE_TTL, JSON.stringify(payload)); } catch { /* best-effort */ }
    }

    return NextResponse.json(payload, { headers: { "X-Cache": "MISS" } });
  } catch (error) {
    console.error("Failed to fetch weekly leaderboard:", error);
    return NextResponse.json({ error: "Leaderboard unavailable", offline: true }, { status: 503 });
  }
}
