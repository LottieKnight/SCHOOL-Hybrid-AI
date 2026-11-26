CREATE TABLE IF NOT EXISTS conversation_presence (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_typing_at TIMESTAMPTZ,
  last_read_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS conversation_presence_user_idx ON conversation_presence(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS conversation_presence_conversation_idx ON conversation_presence(conversation_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS conversation_user_settings (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  muted_until TIMESTAMPTZ,
  blocked BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS conversation_user_settings_user_idx ON conversation_user_settings(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS message_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS message_reports_reporter_idx ON message_reports(reporter_id, created_at DESC);

CREATE TABLE IF NOT EXISTS lesson_checkpoints (
  learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_key TEXT NOT NULL,
  section_key TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (learner_id, lesson_key, section_key)
);

CREATE INDEX IF NOT EXISTS lesson_checkpoints_learner_idx ON lesson_checkpoints(learner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS learner_spaced_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_key TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade INTEGER NOT NULL,
  next_review_at TIMESTAMPTZ NOT NULL,
  score_percent NUMERIC(5,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (learner_id, lesson_key)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'learner_spaced_reviews_status_check'
  ) THEN
    ALTER TABLE learner_spaced_reviews
      ADD CONSTRAINT learner_spaced_reviews_status_check
      CHECK (status IN ('pending', 'done', 'dismissed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS learner_spaced_reviews_due_idx ON learner_spaced_reviews(learner_id, status, next_review_at);

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS app_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS auth_session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_hash TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS auth_session_events_user_idx ON auth_session_events(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS auth_session_events_session_hash_idx ON auth_session_events(session_hash);
