import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";
import { getUserAppPreferences, readAcademicState } from "@/lib/server/userProfileState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // 1. Get weak topics
    const weaknessResult = await queryPlannerDb<{ subject: string }>(
      `SELECT DISTINCT subject FROM weakness_signals WHERE user_id = $1 LIMIT 5`,
      [userId]
    );
    const weakSubjects = weaknessResult.rows.map(r => r.subject);

    // 2. Get upcoming exams
    const preferences = await getUserAppPreferences(userId);
    const academicState = readAcademicState(preferences);
    const now = new Date();
    const upcomingExams = academicState.examDates
      .map(e => ({ ...e, dateObj: new Date(e.date) }))
      .filter(e => e.dateObj > now)
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    // 3. Generate suggestions for the next 7 days
    const suggestions = [];
    for (let i = 1; i <= 7; i++) {
      const date = new Date();
      const dateStr = new Date(date.setDate(date.getDate() + i)).toISOString().slice(0, 10);
      
      // Determine subject: Priority 1: Next Exam, Priority 2: Weakest subject, Priority 3: Random selected subject
      let subject = upcomingExams[0]?.subject || weakSubjects[0] || academicState.selectedSubjects[0] || "General Study";

      suggestions.push({
        student_id: userId,
        title: `Study Session: ${subject}`,
        description: `Auto-scheduled study session for ${subject} based on your learning signals.`,
        event_date: dateStr,
        start_time: "16:00:00",
        end_time: "17:30:00",
        event_type: "personal",
        tier: "tier3",
        is_manual: false,
        colour_tag: "blue",
      });
    }

    // 4. Batch insert into student_planner_events
    for (const s of suggestions) {
      await queryPlannerDb(
        `
          INSERT INTO student_planner_events 
          (student_id, title, description, event_date, start_time, end_time, event_type, tier, is_manual, colour_tag)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT DO NOTHING
        `,
        [s.student_id, s.title, s.description, s.event_date, s.start_time, s.end_time, s.event_type, s.tier, s.is_manual, s.colour_tag]
      );
    }

    return NextResponse.json({ success: true, count: suggestions.length });
  } catch (error) {
    console.error("Failed to auto-schedule:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
