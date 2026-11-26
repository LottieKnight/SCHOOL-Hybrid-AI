"use server";

import "server-only";

import { queryPlannerDb } from "@/lib/server/plannerDb";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type CalendarFreshness = {
  universityId: string;
  calendarUrl: string | null;
  lastVerifiedAt: string | null;
  daysOld: number | null;
  stale: boolean;
  examPeriods: Array<{
    startDate: string;
    endDate: string;
    label: string;
    opportunity: 1 | 2 | 3 | null;
  }>;
};

function toOpportunity(eventType: string): 1 | 2 | 3 | null {
  if (eventType === "exam_opp1_start") return 1;
  if (eventType === "exam_opp2_start") return 2;
  if (eventType === "exam_opp3_start") return 3;
  return null;
}

export async function getCalendarFreshness(universityId: string): Promise<CalendarFreshness> {
  if (!universityId) {
    return {
      universityId: "",
      calendarUrl: null,
      lastVerifiedAt: null,
      daysOld: null,
      stale: false,
      examPeriods: [],
    };
  }

  const [freshnessResult, examPeriodsResult] = await Promise.all([
    queryPlannerDb<{
      calendar_url: string | null;
      last_verified_at: string | null;
    }>(
      `
        SELECT
          universities.calendar_url,
          MIN(academic_calendars.last_verified_at)::text AS last_verified_at
        FROM universities
        LEFT JOIN academic_calendars
          ON academic_calendars.university_id = universities.id
        WHERE universities.id = $1
        GROUP BY universities.calendar_url
      `,
      [universityId]
    ),
    queryPlannerDb<{
      label: string;
      event_type: string;
      start_date: string;
      end_date: string | null;
    }>(
      `
        SELECT
          start_rows.label,
          start_rows.event_type,
          start_rows.start_date::text AS start_date,
          COALESCE(end_rows.start_date::text, start_rows.end_date::text, start_rows.start_date::text) AS end_date
        FROM academic_calendars start_rows
        LEFT JOIN academic_calendars end_rows
          ON end_rows.university_id IS NOT DISTINCT FROM start_rows.university_id
         AND end_rows.campus_id IS NOT DISTINCT FROM start_rows.campus_id
         AND end_rows.year = start_rows.year
         AND end_rows.semester IS NOT DISTINCT FROM start_rows.semester
         AND (
           (start_rows.event_type = 'exam_opp1_start' AND end_rows.event_type = 'exam_opp1_end')
           OR (start_rows.event_type = 'exam_opp2_start' AND end_rows.event_type = 'exam_opp2_end')
           OR (start_rows.event_type = 'exam_opp3_start' AND end_rows.event_type = 'exam_opp3_end')
         )
        WHERE start_rows.university_id = $1
          AND start_rows.is_no_events_period = TRUE
          AND start_rows.event_type IN ('exam_opp1_start', 'exam_opp2_start', 'exam_opp3_start')
        ORDER BY start_rows.start_date ASC
      `,
      [universityId]
    ),
  ]);

  const row = freshnessResult.rows[0];
  const lastVerifiedAt = row?.last_verified_at ?? null;
  const daysOld =
    lastVerifiedAt && Number.isFinite(Date.parse(lastVerifiedAt))
      ? Math.floor((Date.now() - Date.parse(lastVerifiedAt)) / DAY_IN_MS)
      : null;

  return {
    universityId,
    calendarUrl: row?.calendar_url ?? null,
    lastVerifiedAt,
    daysOld,
    stale: daysOld != null && daysOld > 30,
    examPeriods: examPeriodsResult.rows.map((period) => ({
      startDate: period.start_date,
      endDate: period.end_date ?? period.start_date,
      label: period.label,
      opportunity: toOpportunity(period.event_type),
    })),
  };
}
