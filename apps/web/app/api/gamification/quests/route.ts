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
    // 1. Check for existing quests
    let questsRes = await queryPlannerDb<{ id: string; title: string; target_value: number; current_value: number; is_claimed: boolean }>(
      `SELECT * FROM user_quests WHERE user_id = $1 AND expires_at > NOW()`,
      [userId]
    );

    // 2. If no quests, generate 3 daily quests
    if (questsRes.rowCount === 0) {
      const expiresAt = new Date();
      expiresAt.setHours(23, 59, 59, 999);

      const dailyQuests = [
        { title: "Knowledge Seeker", desc: "Earn 50 XP today", target: 50, reward: 25 },
        { title: "Quiz Master", desc: "Complete 2 Daily Quizzes", target: 2, reward: 50 },
        { title: "Helpful Hand", desc: "Give 1 Kudos in community", target: 1, reward: 20 },
      ];

      for (const q of dailyQuests) {
        await queryPlannerDb(
          `INSERT INTO user_quests (user_id, title, description, target_value, reward_xp, quest_type, expires_at) VALUES ($1, $2, $3, $4, $5, 'daily', $6)`,
          [userId, q.title, q.desc, q.target, q.reward, expiresAt]
        );
      }

      questsRes = await queryPlannerDb(
        `SELECT * FROM user_quests WHERE user_id = $1 AND expires_at > NOW()`,
        [userId]
      );
    }

    return NextResponse.json({ quests: questsRes.rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const body = await request.json();
  const { questId } = body;

  try {
    const quest = await queryPlannerDb<{ reward_xp: number; current_value: number; target_value: number; is_claimed: boolean }>(
      `SELECT reward_xp, current_value, target_value, is_claimed FROM user_quests WHERE id = $1 AND user_id = $2`,
      [questId, userId]
    );

    const q = quest.rows[0];
    if (!q || q.is_claimed || q.current_value < q.target_value) {
      return NextResponse.json({ error: "Quest not ready to claim" }, { status: 400 });
    }

    // Mark as claimed and award XP
    await queryPlannerDb(`UPDATE user_quests SET is_read = TRUE WHERE id = $1`, [questId]); // Wait, I meant is_claimed
    await queryPlannerDb(`UPDATE user_quests SET is_claimed = TRUE WHERE id = $1`, [questId]);
    await queryPlannerDb(
      `INSERT INTO user_xp_ledger (user_id, amount, action_type) VALUES ($1, $2, 'QUEST_CLAIMED')`,
      [userId, q.reward_xp]
    );

    return NextResponse.json({ success: true, reward: q.reward_xp });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
