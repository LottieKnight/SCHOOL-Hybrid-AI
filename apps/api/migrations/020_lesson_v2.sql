DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'v2_generation_status') THEN
    CREATE TYPE v2_generation_status AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS v2_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL,
  phase TEXT NOT NULL,
  grade INTEGER NOT NULL,
  subject_key TEXT NOT NULL,
  term INTEGER NOT NULL,
  week INTEGER NOT NULL,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  summary TEXT NOT NULL,
  outcomes JSONB NOT NULL DEFAULT '[]'::jsonb,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  worked_examples JSONB NOT NULL DEFAULT '[]'::jsonb,
  practice JSONB NOT NULL DEFAULT '{}'::jsonb,
  quiz JSONB NOT NULL DEFAULT '{}'::jsonb,
  resources JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS v2_lessons_week_idx
  ON v2_lessons(phase, grade, subject_key, term, week);
CREATE INDEX IF NOT EXISTS v2_lessons_lesson_idx
  ON v2_lessons(lesson_id, version DESC);
CREATE UNIQUE INDEX IF NOT EXISTS v2_lessons_lesson_version_idx
  ON v2_lessons(lesson_id, version);

CREATE TABLE IF NOT EXISTS v2_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID,
  request JSONB NOT NULL DEFAULT '{}'::jsonb,
  status v2_generation_status NOT NULL DEFAULT 'QUEUED',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS v2_generation_jobs_status_idx ON v2_generation_jobs(status);
CREATE INDEX IF NOT EXISTS v2_generation_jobs_lesson_idx ON v2_generation_jobs(lesson_id);
