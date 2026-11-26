import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";
import { getUserAppPreferences, readAcademicState, readDailyQuizState } from "@/lib/server/userProfileState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // 1. Get weak topics
    const weaknessResult = await queryPlannerDb<{ subject: string; topic_text: string; score: number }>(
      `
        SELECT subject, topic_text, AVG(score) as score
        FROM weakness_signals
        WHERE user_id = $1
        GROUP BY subject, topic_text
        ORDER BY AVG(score) DESC
        LIMIT 3
      `,
      [userId]
    );

    // 2. Get user preferences for exams and streaks
    const preferences = await getUserAppPreferences(userId);
    const academicState = readAcademicState(preferences);
    const quizState = readDailyQuizState(preferences);

    // 3. Find closest exam
    const now = new Date();
    const upcomingExams = academicState.examDates
      .map(e => ({ ...e, dateObj: new Date(e.date) }))
      .filter(e => e.dateObj > now)
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    const nextExam = upcomingExams[0] ?? null;

    // 4. Calculate Exam Readiness Score (deterministic heuristic)
    // Base 70%, minus 5% for each high-score weakness signal, plus 2% for each streak day (max 20%)
    let readinessScore = 70;
    readinessScore -= weaknessResult.rows.length * 5;
    readinessScore += Math.min(quizState.currentStreak * 2, 20);
    readinessScore = Math.max(0, Math.min(100, readinessScore));

    return NextResponse.json({
      weakTopics: weaknessResult.rows,
      nextExam,
      streak: quizState.currentStreak,
      readinessScore,
    });
  } catch (error) {
    console.error("Failed to fetch daily briefing:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
