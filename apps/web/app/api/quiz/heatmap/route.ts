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
    const result = await queryPlannerDb<{ quiz_date: string; questions_correct: number; questions_total: number }>(
      `
        SELECT quiz_date::text, questions_correct, questions_total 
        FROM quiz_sessions 
        WHERE user_id = $1 AND completed = TRUE
        ORDER BY quiz_date ASC
      `,
      [userId]
    );

    const activity = result.rows;
    const activityMap = new Map(
      activity.map((row) => [
        row.quiz_date,
        row.questions_total > 0 ? row.questions_correct / row.questions_total : 0,
      ])
    );

    const weeks: { date: string; score: number | null }[][] = [];
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 83);

    for (let weekIndex = 0; weekIndex < 12; weekIndex += 1) {
      const week: { date: string; score: number | null }[] = [];
      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const current = new Date(start);
        current.setDate(start.getDate() + weekIndex * 7 + dayIndex);
        const date = current.toISOString().slice(0, 10);
        const score = activityMap.has(date) ? activityMap.get(date) ?? null : null;
        week.push({ date, score });
      }
      weeks.push(week);
    }

    return NextResponse.json({ activity, weeks });
  } catch (error) {
    console.error("Failed to fetch heatmap data:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
