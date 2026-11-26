CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES tutor_sessions(id) ON DELETE CASCADE,
  opened_by TEXT NOT NULL CHECK (opened_by IN ('learner', 'tutor')),
  status TEXT NOT NULL CHECK (status IN ('open', 'under_review', 'resolved', 'rejected')),
  category TEXT NOT NULL CHECK (category IN ('no_show', 'quality', 'misconduct', 'billing', 'other')),
  description TEXT NOT NULL,
  evidence_uploads TEXT[] NOT NULL DEFAULT '{}',
  admin_notes TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id)
);

CREATE TABLE IF NOT EXISTS refund_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES tutor_sessions(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tutor_strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  session_id UUID REFERENCES tutor_sessions(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('late_cancel', 'no_show', 'misconduct', 'fraud')),
  points INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trust_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES tutor_sessions(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('off_platform_attempt', 'fraud_flag', 'abuse')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learner_risk_scores (
  learner_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cancellations INTEGER NOT NULL DEFAULT 0,
  disputes INTEGER NOT NULL DEFAULT 0,
  failed_payments INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_attempts_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_key TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade INTEGER NOT NULL,
  score_percent NUMERIC(5, 2) NOT NULL,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lesson_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_key TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS topic_mastery (
  learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  grade INTEGER NOT NULL,
  tag TEXT NOT NULL,
  mastery_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (learner_id, subject, grade, tag)
);
