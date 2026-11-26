import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FeedEvent = {
  id: string;
  type: "game_score" | "achievement";
  actor: { username: string | null; avatar_uniform: unknown };
  title: string;
  detail?: string;
  createdAt: string;
  href?: string;
};

const gameLabels: Record<string, string> = {
  exam_dash: "Exam Dash", memory: "Memory", quiz_rush: "Quiz Rush",
  budget_block: "Budget Block", citation_sprint: "Citation Sprint",
  sars_tax_dash: "SARS Tax Dash", source_sorter: "Source Sorter",
  lease_trap: "Lease Trap", cv_optimizer: "CV Optimizer",
  graph_lie_detector: "Graph Lie Detector", email_etiquette: "Email Etiquette",
  debate_clock: "Debate Clock", plain_language: "Plain Language",
  interview_survival: "Interview Survival",
};

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  // Followed user IDs
  const followedRes = await queryPlannerDb<{ friend_id: string }>(
    `SELECT friend_id::text FROM friends WHERE user_id = $1`,
    [userId]
  );
  const followedIds = followedRes.rows.map((r) => r.friend_id);

  if (!followedIds.length) {
    return NextResponse.json({ events: [] });
  }

  const idList = followedIds.map((_, i) => `$${i + 1}`).join(", ");

  // Game score events — respect showGameScores preference
  const gameScoreEvents = await queryPlannerDb<{
    id: string; user_id: string; game_type: string; score: number;
    played_at: string; username: string | null; avatar_uniform: unknown;
    show_game_scores: boolean;
  }>(
    `SELECT
       gs.id::text, gs.user_id::text, gs.game_type, gs.score, gs.played_at,
       p.username, p.avatar_uniform,
       COALESCE((p.app_preferences->'profileSettings'->>'showGameScores')::boolean, true) AS show_game_scores
     FROM game_scores gs
     JOIN user_profiles p ON p.user_id = gs.user_id
     WHERE gs.user_id IN (${idList})
     ORDER BY gs.played_at DESC
     LIMIT 25`,
    followedIds
  );

  // Achievement events
  const achievementEvents = await queryPlannerDb<{
    id: string; user_id: string; title: string; category: string;
    achieved_on: string; username: string | null; avatar_uniform: unknown;
  }>(
    `SELECT
       a.id::text, a.user_id::text, a.title, a.category, a.achieved_on,
       p.username, p.avatar_uniform
     FROM achievements a
     JOIN user_profiles p ON p.user_id = a.user_id
     WHERE a.user_id IN (${idList})
     ORDER BY a.achieved_on DESC
     LIMIT 25`,
    followedIds
  );

  const events: FeedEvent[] = [];

  for (const row of gameScoreEvents.rows) {
    if (!row.show_game_scores) continue;
    const label = gameLabels[row.game_type] ?? row.game_type;
    events.push({
      id: `gs-${row.id}`,
      type: "game_score",
      actor: { username: row.username, avatar_uniform: row.avatar_uniform },
      title: `Scored ${row.score} pts in ${label}`,
      createdAt: row.played_at,
      href: `/community/games/${row.game_type.replace(/_/g, "-")}`,
    });
  }

  for (const row of achievementEvents.rows) {
    events.push({
      id: `ach-${row.id}`,
      type: "achievement",
      actor: { username: row.username, avatar_uniform: row.avatar_uniform },
      title: `Earned "${row.title}"`,
      detail: row.category,
      createdAt: row.achieved_on,
    });
  }

  events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ events: events.slice(0, 50) });
}
