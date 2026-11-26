CREATE TABLE IF NOT EXISTS learner_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  grade INTEGER NOT NULL,
  topic_tag TEXT,
  difficulty_bias INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (learner_id, subject, grade, topic_tag)
);

CREATE INDEX IF NOT EXISTS learner_skills_lookup_idx ON learner_skills (learner_id, subject, grade);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  grade INTEGER NOT NULL,
  lesson_key TEXT NOT NULL,
  topic_tag TEXT,
  score_percent NUMERIC(5, 2) NOT NULL,
  correct_count INTEGER NOT NULL,
  total_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS quiz_attempts_learner_idx ON quiz_attempts (learner_id, subject, grade, created_at DESC);
CREATE INDEX IF NOT EXISTS quiz_attempts_lesson_idx ON quiz_attempts (lesson_key, learner_id);
