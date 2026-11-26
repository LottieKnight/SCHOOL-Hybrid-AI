import "server-only";

import { queryPlannerDb, withPlannerDbClient } from "@/lib/server/plannerDb";
import type {
  EnrolledModuleInput,
  EnrolledModuleRecord,
  PlannerEventType,
  StudentPlannerEventRecord,
  StudentUniversityProfileRecord,
  UniversityCampusRecord,
  UniversityRecord,
} from "@/types/planner";

type UniversityRow = {
  id: string;
  name: string;
  short_code: string;
  country: string;
  student_system: UniversityRecord["studentSystem"];
  calendar_url: string | null;
  exam_timetable_url: string | null;
  class_timetable_url: string | null;
  yearbook_url: string | null;
  portal_url: string | null;
  is_active: boolean;
};

type UniversityCampusRow = {
  id: string;
  university_id: string;
  campus_name: string;
  campus_code: string;
  city: string | null;
  province: string | null;
  is_primary: boolean;
};

type StudentUniversityProfileRow = {
  id: string;
  student_id: string;
  university_id: string;
  campus_id: string | null;
  faculty: string | null;
  year_of_study: number | null;
  qualification: string | null;
  student_number: string | null;
  onboarding_completed: boolean;
  tier2_activated: boolean;
  tier3_activated: boolean;
};

type EnrolledModuleRow = {
  id: string;
  student_id: string;
  university_id: string;
  campus_id: string | null;
  module_code: string;
  module_name: string | null;
  year: number;
  semester: number | null;
  credits: number | null;
  is_active: boolean;
};

type PlannerEventRow = {
  id: string;
  student_id: string;
  title: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  event_type: PlannerEventType;
  tier: StudentPlannerEventRecord["tier"];
  source_ref_id: string | null;
  source_table: string | null;
  university_id: string | null;
  module_code: string | null;
  is_manual: boolean;
  is_dismissed: boolean;
  colour_tag: string | null;
};

type ModuleTimetableRow = {
  id: string;
  university_id: string;
  campus_id: string | null;
  module_code: string;
  module_name: string | null;
  semester: number;
  year: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  venue: string | null;
  group_code: string | null;
  lecturer: string | null;
};

type ExamTimetableRow = {
  id: string;
  university_id: string;
  campus_id: string | null;
  module_code: string;
  module_name: string | null;
  opportunity: number;
  year: number;
  exam_date: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  paper_number: number | null;
};

type SemesterWindow = {
  semester: number;
  startDate: string;
  endDate: string;
};

const DAY_INDEX: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function mapUniversityRow(row: UniversityRow): UniversityRecord {
  return {
    id: row.id,
    name: row.name,
    shortCode: row.short_code,
    country: row.country,
    studentSystem: row.student_system,
    calendarUrl: row.calendar_url,
    examTimetableUrl: row.exam_timetable_url,
    classTimetableUrl: row.class_timetable_url,
    yearbookUrl: row.yearbook_url,
    portalUrl: row.portal_url,
    isActive: row.is_active,
  };
}

function mapUniversityCampusRow(row: UniversityCampusRow): UniversityCampusRecord {
  return {
    id: row.id,
    universityId: row.university_id,
    campusName: row.campus_name,
    campusCode: row.campus_code,
    city: row.city,
    province: row.province,
    isPrimary: row.is_primary,
  };
}

function mapStudentUniversityProfileRow(row: StudentUniversityProfileRow): StudentUniversityProfileRecord {
  return {
    id: row.id,
    studentId: row.student_id,
    universityId: row.university_id,
    campusId: row.campus_id,
    faculty: row.faculty,
    yearOfStudy: row.year_of_study,
    qualification: row.qualification,
    studentNumber: row.student_number,
    onboardingCompleted: row.onboarding_completed,
    tier2Activated: row.tier2_activated,
    tier3Activated: row.tier3_activated,
  };
}

function mapEnrolledModuleRow(row: EnrolledModuleRow): EnrolledModuleRecord {
  return {
    id: row.id,
    studentId: row.student_id,
    universityId: row.university_id,
    campusId: row.campus_id,
    moduleCode: row.module_code,
    moduleName: row.module_name,
    year: row.year,
    semester: row.semester,
    credits: row.credits,
    isActive: row.is_active,
  };
}

function mapPlannerEventRow(row: PlannerEventRow): StudentPlannerEventRecord {
  return {
    id: row.id,
    studentId: row.student_id,
    title: row.title,
    description: row.description,
    eventDate: row.event_date,
    endDate: row.end_date,
    startTime: row.start_time,
    endTime: row.end_time,
    eventType: row.event_type,
    tier: row.tier,
    sourceRefId: row.source_ref_id,
    sourceTable: row.source_table,
    universityId: row.university_id,
    moduleCode: row.module_code,
    isManual: row.is_manual,
    isDismissed: row.is_dismissed,
    colourTag: row.colour_tag,
  };
}

function buildClassOccurrences(window: SemesterWindow, dayOfWeek: string) {
  const targetDay = DAY_INDEX[dayOfWeek];
  if (!targetDay) return [];

  const current = new Date(`${window.startDate}T00:00:00Z`);
  const end = new Date(`${window.endDate}T00:00:00Z`);
  while (current.getUTCDay() !== targetDay) {
    current.setUTCDate(current.getUTCDate() + 1);
  }

  const dates: string[] = [];
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 7);
  }
  return dates;
}

function normaliseSemesterSelection(value: EnrolledModuleInput["semester"]) {
  if (value === "both") return [1, 2] as const;
  if (value === 1 || value === 2) return [value] as const;
  return [null] as const;
}

export async function listPlannerUniversities() {
  const result = await queryPlannerDb<UniversityRow>(
    `
      SELECT
        id::text AS id,
        name,
        short_code,
        country,
        student_system,
        calendar_url,
        exam_timetable_url,
        class_timetable_url,
        yearbook_url,
        portal_url,
        is_active
      FROM universities
      WHERE is_active = TRUE
      ORDER BY name ASC
    `
  );

  return result.rows.map(mapUniversityRow);
}

export async function listPlannerCampuses(universityId: string) {
  const result = await queryPlannerDb<UniversityCampusRow>(
    `
      SELECT
        id::text AS id,
        university_id::text AS university_id,
        campus_name,
        campus_code,
        city,
        province,
        is_primary
      FROM university_campuses
      WHERE university_id = $1
      ORDER BY is_primary DESC, campus_name ASC
    `,
    [universityId]
  );

  return result.rows.map(mapUniversityCampusRow);
}

export async function getStudentUniversityProfile(studentId: string) {
  const result = await queryPlannerDb<StudentUniversityProfileRow>(
    `
      SELECT
        id::text AS id,
        student_id::text AS student_id,
        university_id::text AS university_id,
        campus_id::text AS campus_id,
        faculty,
        year_of_study,
        qualification,
        student_number,
        onboarding_completed,
        tier2_activated,
        tier3_activated
      FROM student_university_profiles
      WHERE student_id = $1
      LIMIT 1
    `,
    [studentId]
  );

  if (result.rowCount === 0) return null;
  return mapStudentUniversityProfileRow(result.rows[0]);
}

export async function listStudentEnrolledModules(studentId: string) {
  const result = await queryPlannerDb<EnrolledModuleRow>(
    `
      SELECT
        id::text AS id,
        student_id::text AS student_id,
        university_id::text AS university_id,
        campus_id::text AS campus_id,
        module_code,
        module_name,
        year,
        semester,
        credits,
        is_active
      FROM enrolled_modules
      WHERE student_id = $1
      ORDER BY module_code ASC, semester ASC NULLS LAST
    `,
    [studentId]
  );

  return result.rows.map(mapEnrolledModuleRow);
}

export async function listStudentPlannerEvents(studentId: string) {
  const result = await queryPlannerDb<PlannerEventRow>(
    `
      SELECT
        id::text AS id,
        student_id::text AS student_id,
        title,
        description,
        event_date::text AS event_date,
        end_date::text AS end_date,
        start_time::text AS start_time,
        end_time::text AS end_time,
        event_type,
        tier,
        source_ref_id::text AS source_ref_id,
        source_table,
        university_id::text AS university_id,
        module_code,
        is_manual,
        is_dismissed,
        colour_tag
      FROM student_planner_events
      WHERE student_id = $1
        AND is_dismissed = FALSE
      ORDER BY event_date ASC, start_time ASC NULLS LAST, title ASC
    `,
    [studentId]
  );

  return result.rows.map(mapPlannerEventRow);
}

export async function saveStudentUniversityProfile(input: {
  studentId: string;
  universityId: string;
  campusId?: string | null;
  faculty?: string | null;
  yearOfStudy?: number | null;
  qualification?: string | null;
  studentNumber?: string | null;
  onboardingCompleted?: boolean;
  tier2Activated?: boolean;
  tier3Activated?: boolean;
}) {
  const result = await queryPlannerDb<StudentUniversityProfileRow>(
    `
      INSERT INTO student_university_profiles (
        student_id,
        university_id,
        campus_id,
        faculty,
        year_of_study,
        qualification,
        student_number,
        onboarding_completed,
        tier2_activated,
        tier3_activated
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (student_id) DO UPDATE
      SET university_id = EXCLUDED.university_id,
          campus_id = EXCLUDED.campus_id,
          faculty = EXCLUDED.faculty,
          year_of_study = EXCLUDED.year_of_study,
          qualification = EXCLUDED.qualification,
          student_number = EXCLUDED.student_number,
          onboarding_completed = EXCLUDED.onboarding_completed,
          tier2_activated = EXCLUDED.tier2_activated,
          tier3_activated = EXCLUDED.tier3_activated,
          updated_at = NOW()
      RETURNING
        id::text AS id,
        student_id::text AS student_id,
        university_id::text AS university_id,
        campus_id::text AS campus_id,
        faculty,
        year_of_study,
        qualification,
        student_number,
        onboarding_completed,
        tier2_activated,
        tier3_activated
    `,
    [
      input.studentId,
      input.universityId,
      input.campusId ?? null,
      input.faculty ?? null,
      input.yearOfStudy ?? null,
      input.qualification ?? null,
      input.studentNumber ?? null,
      input.onboardingCompleted ?? false,
      input.tier2Activated ?? false,
      input.tier3Activated ?? false,
    ]
  );

  return mapStudentUniversityProfileRow(result.rows[0]);
}

export async function replaceStudentEnrolledModules(input: {
  studentId: string;
  universityId: string;
  campusId?: string | null;
  year: number;
  modules: EnrolledModuleInput[];
}) {
  const trimmedModules = input.modules
    .map((entry) => ({
      moduleCode: entry.moduleCode.trim().toUpperCase(),
      moduleName: entry.moduleName?.trim() || null,
      semester: entry.semester ?? null,
      credits: typeof entry.credits === "number" ? Math.max(0, Math.round(entry.credits)) : null,
    }))
    .filter((entry) => entry.moduleCode.length > 0);

  return withPlannerDbClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(
        `
          DELETE FROM enrolled_modules
          WHERE student_id = $1
            AND year = $2
        `,
        [input.studentId, input.year]
      );

      const inserted: EnrolledModuleRecord[] = [];
      for (const entry of trimmedModules) {
        for (const semester of normaliseSemesterSelection(entry.semester)) {
          const result = await client.query<EnrolledModuleRow>(
            `
              INSERT INTO enrolled_modules (
                student_id,
                university_id,
                campus_id,
                module_code,
                module_name,
                year,
                semester,
                credits,
                is_active
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
              ON CONFLICT (student_id, module_code, year, semester) DO UPDATE
              SET university_id = EXCLUDED.university_id,
                  campus_id = EXCLUDED.campus_id,
                  module_name = EXCLUDED.module_name,
                  credits = EXCLUDED.credits,
                  is_active = TRUE,
                  updated_at = NOW()
              RETURNING
                id::text AS id,
                student_id::text AS student_id,
                university_id::text AS university_id,
                campus_id::text AS campus_id,
                module_code,
                module_name,
                year,
                semester,
                credits,
                is_active
            `,
            [
              input.studentId,
              input.universityId,
              input.campusId ?? null,
              entry.moduleCode,
              entry.moduleName,
              input.year,
              semester,
              entry.credits,
            ]
          );
          inserted.push(mapEnrolledModuleRow(result.rows[0]));
        }
      }

      await client.query("COMMIT");
      return inserted;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function populateTier1PlannerEvents(studentId: string, universityId: string | null) {
  const result = await queryPlannerDb<{ inserted_count: number }>(
    `SELECT populate_tier1_planner($1, $2) AS inserted_count`,
    [studentId, universityId]
  );
  return result.rows[0]?.inserted_count ?? 0;
}

async function getSemesterWindows(universityId: string, year: number, campusId?: string | null) {
  const result = await queryPlannerDb<{
    semester: number;
    start_date: string;
    end_date: string;
  }>(
    `
      SELECT
        start_rows.semester,
        start_rows.start_date::text AS start_date,
        end_rows.start_date::text AS end_date
      FROM academic_calendars start_rows
      JOIN academic_calendars end_rows
        ON end_rows.university_id IS NOT DISTINCT FROM start_rows.university_id
       AND end_rows.campus_id IS NOT DISTINCT FROM start_rows.campus_id
       AND end_rows.year = start_rows.year
       AND end_rows.semester = start_rows.semester
       AND end_rows.event_type = 'semester_end'
      WHERE start_rows.university_id = $1
        AND ($2::uuid IS NULL OR start_rows.campus_id IS NULL OR start_rows.campus_id = $2::uuid)
        AND start_rows.year = $3
        AND start_rows.event_type = 'semester_start'
      ORDER BY start_rows.semester ASC
    `,
    [universityId, campusId ?? null, year]
  );

  return result.rows.map((row) => ({
    semester: row.semester,
    startDate: row.start_date,
    endDate: row.end_date,
  }));
}

export async function syncTier2PlannerEventsForStudent(input: {
  studentId: string;
  universityId: string;
  campusId?: string | null;
  year: number;
}) {
  const [modules, semesterWindows] = await Promise.all([
    listStudentEnrolledModules(input.studentId),
    getSemesterWindows(input.universityId, input.year, input.campusId),
  ]);
  const semesterWindowMap = new Map(semesterWindows.map((entry) => [entry.semester, entry]));

  return withPlannerDbClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(
        `
          DELETE FROM student_planner_events
          WHERE student_id = $1
            AND tier = 'tier2'
            AND source_table IN ('module_timetables', 'exam_timetables')
        `,
        [input.studentId]
      );

      const timetableResult = await client.query<ModuleTimetableRow>(
        `
          SELECT
            id::text AS id,
            university_id::text AS university_id,
            campus_id::text AS campus_id,
            module_code,
            module_name,
            semester,
            year,
            day_of_week,
            start_time::text AS start_time,
            end_time::text AS end_time,
            venue,
            group_code,
            lecturer
          FROM module_timetables
          WHERE university_id = $1
            AND year = $2
            AND module_code = ANY($3::text[])
          ORDER BY module_code ASC, semester ASC, day_of_week ASC, start_time ASC
        `,
        [input.universityId, input.year, modules.map((entry) => entry.moduleCode)]
      );

      let inserted = 0;
      for (const row of timetableResult.rows) {
        const window = semesterWindowMap.get(row.semester);
        if (!window) continue;

        for (const eventDate of buildClassOccurrences(window, row.day_of_week)) {
          const title = row.module_name
            ? `${row.module_code} · ${row.module_name}`
            : `${row.module_code} class`;
          const description = [row.venue, row.group_code, row.lecturer].filter(Boolean).join(" · ") || null;

          const insertResult = await client.query(
            `
              INSERT INTO student_planner_events (
                student_id,
                title,
                description,
                event_date,
                start_time,
                end_time,
                event_type,
                tier,
                source_ref_id,
                source_table,
                university_id,
                module_code,
                is_manual
              )
              VALUES ($1, $2, $3, $4, $5, $6, 'class', 'tier2', $7, 'module_timetables', $8, $9, FALSE)
              ON CONFLICT DO NOTHING
            `,
            [
              input.studentId,
              title,
              description,
              eventDate,
              row.start_time,
              row.end_time,
              row.id,
              input.universityId,
              row.module_code,
            ]
          );
          inserted += insertResult.rowCount ?? 0;
        }
      }

      const examResult = await client.query<ExamTimetableRow>(
        `
          SELECT
            id::text AS id,
            university_id::text AS university_id,
            campus_id::text AS campus_id,
            module_code,
            module_name,
            opportunity,
            year,
            exam_date::text AS exam_date,
            start_time::text AS start_time,
            end_time::text AS end_time,
            venue,
            paper_number
          FROM exam_timetables
          WHERE university_id = $1
            AND year = $2
            AND module_code = ANY($3::text[])
          ORDER BY exam_date ASC, start_time ASC NULLS LAST
        `,
        [input.universityId, input.year, modules.map((entry) => entry.moduleCode)]
      );

      for (const row of examResult.rows) {
        const titleParts = [row.module_code];
        if (row.paper_number) {
          titleParts.push(`Paper ${row.paper_number}`);
        } else {
          titleParts.push(`Opportunity ${row.opportunity}`);
        }
        const description = [row.module_name, row.venue].filter(Boolean).join(" · ") || null;
        const insertResult = await client.query(
          `
            INSERT INTO student_planner_events (
              student_id,
              title,
              description,
              event_date,
              start_time,
              end_time,
              event_type,
              tier,
              source_ref_id,
              source_table,
              university_id,
              module_code,
              is_manual
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'exam', 'tier2', $7, 'exam_timetables', $8, $9, FALSE)
            ON CONFLICT DO NOTHING
          `,
          [
            input.studentId,
            titleParts.join(" · "),
            description,
            row.exam_date,
            row.start_time,
            row.end_time,
            row.id,
            input.universityId,
            row.module_code,
          ]
        );
        inserted += insertResult.rowCount ?? 0;
      }

      await client.query(
        `
          UPDATE student_university_profiles
          SET tier2_activated = $2,
              updated_at = NOW()
          WHERE student_id = $1
        `,
        [input.studentId, inserted > 0]
      );

      await client.query("COMMIT");
      return inserted;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}
