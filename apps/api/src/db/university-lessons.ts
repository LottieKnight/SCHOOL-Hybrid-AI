import { pool } from "./pool.js";
import { LessonV1Schema, type LessonV1 } from "@saedu/shared";

export type UniversityLessonRecord = {
  id: string;
  institution: string;
  faculty: string;
  course: string;
  year_of_study: number;
  module_code: string;
  module_name: string | null;
  lesson_json: LessonV1;
  generated_at: string;
  model_used: string | null;
  prompt_hash: string | null;
  created_at: string;
  updated_at: string;
};

function parseRecord(row: Record<string, unknown>): UniversityLessonRecord {
  return {
    id: String(row.id),
    institution: String(row.institution),
    faculty: String(row.faculty),
    course: String(row.course),
    year_of_study: Number(row.year_of_study),
    module_code: String(row.module_code),
    module_name: row.module_name != null ? String(row.module_name) : null,
    lesson_json: LessonV1Schema.parse(row.lesson_json),
    generated_at: String(row.generated_at),
    model_used: row.model_used != null ? String(row.model_used) : null,
    prompt_hash: row.prompt_hash != null ? String(row.prompt_hash) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

// Normalize text keys so that institution/faculty/course mismatches
// ("University of Johannesburg" vs "university of johannesburg") never
// silently miss a lesson. Module code is uppercased for the same reason.
function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

export async function upsertUniversityLesson(params: {
  institution: string;
  faculty: string;
  course: string;
  yearOfStudy: number;
  moduleCode: string;
  moduleName?: string;
  lesson: LessonV1;
  modelUsed?: string;
  promptHash?: string;
}): Promise<UniversityLessonRecord> {
  const result = await pool.query(
    `
    INSERT INTO university_lessons
      (institution, faculty, course, year_of_study, module_code, module_name,
       lesson_json, generated_at, model_used, prompt_hash, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, NOW())
    ON CONFLICT (LOWER(institution), LOWER(faculty), LOWER(course), year_of_study, UPPER(module_code))
    DO UPDATE SET
      lesson_json  = EXCLUDED.lesson_json,
      module_name  = COALESCE(EXCLUDED.module_name, university_lessons.module_name),
      generated_at = NOW(),
      model_used   = EXCLUDED.model_used,
      prompt_hash  = EXCLUDED.prompt_hash,
      updated_at   = NOW()
    RETURNING *
    `,
    [
      normalizeKey(params.institution),
      normalizeKey(params.faculty),
      normalizeKey(params.course),
      params.yearOfStudy,
      params.moduleCode.trim().toUpperCase(),
      params.moduleName ?? null,
      JSON.stringify(params.lesson),
      params.modelUsed ?? null,
      params.promptHash ?? null,
    ]
  );
  return parseRecord(result.rows[0]);
}

export async function getUniversityLesson(params: {
  institution: string;
  faculty: string;
  course: string;
  yearOfStudy: number;
  moduleCode: string;
}): Promise<UniversityLessonRecord | null> {
  const result = await pool.query(
    `
    SELECT * FROM university_lessons
    WHERE LOWER(institution) = LOWER($1)
      AND LOWER(faculty)     = LOWER($2)
      AND LOWER(course)      = LOWER($3)
      AND year_of_study      = $4
      AND UPPER(module_code) = UPPER($5)
    LIMIT 1
    `,
    [params.institution, params.faculty, params.course, params.yearOfStudy, params.moduleCode]
  );
  if (!result.rows[0]) return null;
  return parseRecord(result.rows[0]);
}

export async function listUniversityLessons(params: {
  institution?: string;
  moduleCode?: string;
  limit?: number;
  offset?: number;
}): Promise<UniversityLessonRecord[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (params.institution) {
    conditions.push(`LOWER(institution) = LOWER($${idx++})`);
    values.push(params.institution);
  }
  if (params.moduleCode) {
    conditions.push(`UPPER(module_code) = UPPER($${idx++})`);
    values.push(params.moduleCode);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;
  values.push(limit, offset);

  const result = await pool.query(
    `SELECT * FROM university_lessons ${where} ORDER BY generated_at DESC LIMIT $${idx++} OFFSET $${idx}`,
    values
  );
  return result.rows.map(parseRecord);
}
