CREATE TABLE IF NOT EXISTS university_lessons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution   TEXT NOT NULL,
  faculty       TEXT NOT NULL,
  course        TEXT NOT NULL,
  year_of_study INT NOT NULL CHECK (year_of_study BETWEEN 1 AND 8),
  module_code   TEXT NOT NULL,
  module_name   TEXT,
  lesson_json   JSONB NOT NULL,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model_used    TEXT,
  prompt_hash   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (institution, faculty, course, year_of_study, module_code)
);

CREATE INDEX IF NOT EXISTS idx_university_lessons_module_code
  ON university_lessons(UPPER(module_code));

CREATE INDEX IF NOT EXISTS idx_university_lessons_institution
  ON university_lessons(institution);

CREATE INDEX IF NOT EXISTS idx_university_lessons_generated_at
  ON university_lessons(generated_at DESC);
