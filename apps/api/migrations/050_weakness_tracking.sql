-- Topics table (curriculum nodes)
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  name TEXT NOT NULL,
  grade INTEGER,
  phase TEXT,
  term INTEGER,
  week INTEGER,
  bloom_level TEXT CHECK (bloom_level IN (
    'remember','understand','apply',
    'analyse','evaluate','create'
  )),
  caps_aligned BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Weakness signals (core retention engine)
CREATE TABLE IF NOT EXISTS weakness_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id)
    ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id),
  subject TEXT NOT NULL,
  topic_text TEXT NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'wrong_answer',
    'repeated_question',
    'low_quiz_score',
    'explicit_struggle',
    'time_spent_high'
  )),
  score FLOAT CHECK (score >= 0 AND score <= 1),
  session_id UUID,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- Session topic tracking
CREATE TABLE IF NOT EXISTS ai_session_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  topic_text TEXT NOT NULL,
  subject_inferred TEXT,
  grade_inferred INTEGER,
  weakness_detected BOOLEAN DEFAULT FALSE,
  difficulty_level INTEGER CHECK (
    difficulty_level BETWEEN 1 AND 5
  ),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Question bank
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES topics(id),
  subject TEXT NOT NULL,
  grade INTEGER,
  question_text TEXT NOT NULL,
  answer TEXT NOT NULL,
  difficulty INTEGER DEFAULT 3 CHECK (
    difficulty BETWEEN 1 AND 5
  ),
  bloom_level TEXT CHECK (bloom_level IN (
    'remember','understand','apply',
    'analyse','evaluate','create'
  )),
  source TEXT DEFAULT 'ai_generated',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Daily quiz sessions
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id)
    ON DELETE CASCADE,
  quiz_date DATE NOT NULL DEFAULT CURRENT_DATE,
  questions_total INTEGER DEFAULT 5,
  questions_correct INTEGER DEFAULT 0,
  score_percent FLOAT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, quiz_date)
);

-- Quiz answers
CREATE TABLE IF NOT EXISTS quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_session_id UUID NOT NULL
    REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id),
  question_text TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  student_answer TEXT,
  is_correct BOOLEAN,
  answered_at TIMESTAMPTZ DEFAULT now()
);

-- Streak tracking (add columns to user_profiles)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS current_streak
    INTEGER DEFAULT 0;
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS longest_streak
    INTEGER DEFAULT 0;
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS last_active_date DATE;
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS streak_freeze_count
    INTEGER DEFAULT 2;
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS exam_dates JSONB
    DEFAULT '[]'::jsonb;
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete
    BOOLEAN DEFAULT FALSE;
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS selected_subjects
    JSONB DEFAULT '[]'::jsonb;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weakness_user
  ON weakness_signals(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_weakness_subject
  ON weakness_signals(user_id, subject);
CREATE INDEX IF NOT EXISTS idx_quiz_user_date
  ON quiz_sessions(user_id, quiz_date DESC);
CREATE INDEX IF NOT EXISTS idx_questions_subject
  ON questions(subject, grade, is_active);
CREATE INDEX IF NOT EXISTS idx_session_topics
  ON ai_session_topics(session_id);
