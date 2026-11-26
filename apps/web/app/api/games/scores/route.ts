import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";
import { awardScholarCredits } from "@/lib/server/creditsAward";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await request.json();
  const { gameType, score, metadata, runId } = body;

  if (!gameType || typeof score !== "number") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    // Record game score
    await queryPlannerDb(
      `INSERT INTO game_scores (user_id, game_type, score, metadata) VALUES ($1, $2, $3, $4)`,
      [userId, gameType, score, JSON.stringify(metadata ?? {})]
    );

    // Award XP (e.g., 50 XP for completing a game)
    await queryPlannerDb(
      `INSERT INTO user_xp_ledger (user_id, amount, action_type, metadata) VALUES ($1, $2, $3, $4)`,
      [userId, 50, "GAME_COMPLETE", JSON.stringify({ gameType, score })]
    );

    // Scholar Credits (best-effort, non-blocking). game_scores has no unique
    // constraint, so the per-source daily caps in credit-rules.ts are the
    // backstop against farming (BRAZIL 3/day, Exam Dash 10/day). Award keys are
    // derived from stable run identity (a per-playthrough runId for BRAZIL, the
    // achieved score for Exam Dash), so a retried submission can never
    // double-earn — unlike the previous Date.now() keys.
    if (gameType === "brazil") {
      const brazilRunId = typeof runId === "string" && runId.trim().length > 0 ? runId.trim() : score;
      await awardScholarCredits(request, {
        source: "GAME_BRAZIL_COMPLETE",
        venture: "SCHOOL",
        description: "BRAZIL game completed",
        idempotencyKey: `game:brazil:${userId}:${brazilRunId}`,
        referenceId: `${userId}-brazil`,
        referenceType: "game_score",
        metadata: { gameType, score, runId: brazilRunId },
      });
    } else if (gameType === "exam_dash") {
      const bestResult = await queryPlannerDb<{ max_score: number }>(
        `SELECT COALESCE(MAX(score), 0) AS max_score FROM game_scores WHERE user_id = $1 AND game_type = $2`,
        [userId, gameType]
      );
      const previousBest = Number(bestResult.rows?.[0]?.max_score ?? 0);
      const isNewHighScore = score > previousBest;

      if (isNewHighScore) {
        await awardScholarCredits(request, {
          source: "GAME_EXAM_DASH_HIGH_SCORE",
          venture: "SCHOOL",
          description: "Exam Dash high score",
          idempotencyKey: `game:exam_dash:${userId}:${score}`,
          referenceId: `${userId}-exam-dash`,
          referenceType: "game_score",
          metadata: { gameType, score, isNewHighScore },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to record score/XP:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
