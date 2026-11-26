import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BADGE_DEFINITIONS = [
  { key: "streak_7", title: "Week Warrior", description: "Maintain a 7-day study streak", icon: "🔥", tier: "bronze" },
  { key: "streak_30", title: "Monthly Master", description: "Maintain a 30-day study streak", icon: "💎", tier: "gold" },
  { key: "top_contributor", title: "Knowledge Sharer", description: "Get 10 accepted answers in community", icon: "🌟", tier: "silver" },
  { key: "speed_demon", title: "Speed Demon", description: "Reach 80 WPM in Exam Dash", icon: "⚡", tier: "silver" },
  { key: "first_perfect_quiz", title: "Perfect Start", description: "Get 100% on your first daily quiz", icon: "🎯", tier: "bronze" },
  { key: "pool_shark", title: "Pool Shark", description: "Pot all reds in under 10 shots", icon: "🎱", tier: "gold" },
];

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const result = await queryPlannerDb<{ badge_key: string; earned_at: string }>(
      `SELECT badge_key, earned_at::text FROM user_earned_badges WHERE user_id = $1`,
      [userId]
    );

    const earnedKeys = new Set(result.rows.map(r => r.badge_key));
    const badges = BADGE_DEFINITIONS.map(def => ({
      ...def,
      earned_at: earnedKeys.has(def.key) ? result.rows.find(r => r.badge_key === def.key)?.earned_at : null,
    }));

    return NextResponse.json({ badges });
  } catch (error) {
    console.error("Failed to fetch badges:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
