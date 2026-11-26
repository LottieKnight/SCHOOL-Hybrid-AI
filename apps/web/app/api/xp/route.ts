import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";
import { resolveXpAward } from "@/lib/xpAward";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type XpLedgerRow = {
  action_type: string;
  amount: string;
  metadata: Record<string, unknown> | null;
};

type XpRecentEvent = {
  label: string;
  xp: number;
};

function humanizeActionType(actionType: string) {
  return actionType
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildXpEvent(row: XpLedgerRow): XpRecentEvent {
  const amount = Math.max(0, parseInt(row.amount ?? "0", 10) || 0);
  const metadata = row.metadata ?? {};

  if (row.action_type === "QUIZ_COMPLETE") {
    const questionsCorrect = typeof metadata.questionsCorrect === "number" ? metadata.questionsCorrect : null;
    const questionsTotal = typeof metadata.questionsTotal === "number" ? metadata.questionsTotal : null;
    return {
      label:
        questionsCorrect !== null && questionsTotal !== null
          ? `Quiz ${questionsCorrect}/${questionsTotal}`
          : "Quiz completed",
      xp: amount,
    };
  }

  if (row.action_type === "GAME_COMPLETE") {
    const gameType = typeof metadata.gameType === "string" ? metadata.gameType : null;
    return {
      label: gameType ? `${humanizeActionType(row.action_type)}: ${gameType.replace(/_/g, " ")}` : "Game complete",
      xp: amount,
    };
  }

  if (row.action_type === "QUEST_CLAIMED") {
    return {
      label: "Quest claimed",
      xp: amount,
    };
  }

  return {
    label: humanizeActionType(row.action_type),
    xp: amount,
  };
}

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const result = await queryPlannerDb<{ total_xp: string }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS total_xp FROM user_xp_ledger WHERE user_id = $1`,
      [userId]
    );

    const totalXp = parseInt(result.rows[0]?.total_xp ?? "0", 10);
    const level = Math.floor(Math.sqrt(totalXp / 100)) + 1;
    const xpForCurrentLevel = 100 * Math.pow(level - 1, 2);
    const xpForNextLevel = 100 * Math.pow(level, 2);
    const progress = totalXp - xpForCurrentLevel;
    const required = xpForNextLevel - xpForCurrentLevel;
    const recentResult = await queryPlannerDb<XpLedgerRow>(
      `
        SELECT action_type, amount::text AS amount, metadata
        FROM user_xp_ledger
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 3
      `,
      [userId]
    );

    return NextResponse.json({
      totalXp,
      level,
      progress,
      required,
      nextLevelXp: xpForNextLevel,
      recentEvents: recentResult.rows.map((row) => buildXpEvent(row)),
    });
  } catch (error) {
    console.error("Failed to fetch XP:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await request.json().catch(() => null);
  const award = resolveXpAward(body?.actionType, body?.amount);
  if (!award.ok) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    await queryPlannerDb(
      `INSERT INTO user_xp_ledger (user_id, amount, action_type, metadata) VALUES ($1, $2, $3, $4)`,
      [userId, award.amount, award.actionType, JSON.stringify(body?.metadata ?? {})]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to record XP:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
