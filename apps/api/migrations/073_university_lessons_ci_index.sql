-- Replace the plain UNIQUE constraint on university_lessons with a
-- case-insensitive functional unique index so that institution/faculty/course
-- comparisons are case-insensitive regardless of how they were stored.
-- Module code is already uppercased on insert; keep it that way.

-- Drop the auto-named constraint created in migration 072.
-- The constraint name is deterministic from column order.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'university_lessons'::regclass
      AND contype = 'u'
      AND conname LIKE 'university_lessons_institution_faculty_course%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE university_lessons DROP CONSTRAINT ' || conname
      FROM pg_constraint
      WHERE conrelid = 'university_lessons'::regclass
        AND contype = 'u'
        AND conname LIKE 'university_lessons_institution_faculty_course%'
      LIMIT 1
    );
  END IF;
END;
$$;

-- Case-insensitive unique index: same lesson slot regardless of case variations.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_university_lessons_ci
  ON university_lessons (LOWER(institution), LOWER(faculty), LOWER(course), year_of_study, UPPER(module_code));
