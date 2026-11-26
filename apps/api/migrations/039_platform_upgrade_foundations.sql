ALTER TABLE trust_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS assigned_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trust_events_status_check'
  ) THEN
    ALTER TABLE trust_events
      ADD CONSTRAINT trust_events_status_check
      CHECK (status IN ('new', 'in_review', 'resolved'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS trust_events_status_created_idx
  ON trust_events (status, created_at DESC);

CREATE INDEX IF NOT EXISTS trust_events_assigned_admin_idx
  ON trust_events (assigned_admin_id, created_at DESC);

CREATE TABLE IF NOT EXISTS trust_event_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trust_event_id UUID NOT NULL REFERENCES trust_events(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL DEFAULT 'note',
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trust_event_notes_action_type_check'
  ) THEN
    ALTER TABLE trust_event_notes
      ADD CONSTRAINT trust_event_notes_action_type_check
      CHECK (
        action_type IN (
          'note',
          'warn',
          'mute',
          'suspend',
          'dismiss',
          'assign',
          'status_change'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS trust_event_notes_event_created_idx
  ON trust_event_notes (trust_event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_suspensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  suspended_by UUID REFERENCES users(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS user_suspensions_lookup_idx
  ON user_suspensions (user_id, starts_at DESC);

ALTER TABLE message_attachments
  ADD COLUMN IF NOT EXISTS scan_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS scan_reason TEXT,
  ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'message_attachments_scan_status_check'
  ) THEN
    ALTER TABLE message_attachments
      ADD CONSTRAINT message_attachments_scan_status_check
      CHECK (scan_status IN ('pending', 'clean', 'blocked'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS conversation_attachment_quotas (
  conversation_id UUID PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  max_bytes BIGINT NOT NULL DEFAULT 262144000,
  retention_days INT NOT NULL DEFAULT 30,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  total_bytes BIGINT NOT NULL CHECK (total_bytes > 0),
  uploaded_bytes BIGINT NOT NULL DEFAULT 0 CHECK (uploaded_bytes >= 0),
  temp_storage_path TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'open',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 day',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'message_upload_sessions_status_check'
  ) THEN
    ALTER TABLE message_upload_sessions
      ADD CONSTRAINT message_upload_sessions_status_check
      CHECK (status IN ('open', 'completed', 'aborted', 'expired'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS message_upload_sessions_user_status_idx
  ON message_upload_sessions (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS message_upload_sessions_expiry_idx
  ON message_upload_sessions (expires_at);

ALTER TABLE conversation_user_settings
  ADD COLUMN IF NOT EXISTS channel_reply_in_thread_default BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS channel_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  linked_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'channel_tasks_status_check'
  ) THEN
    ALTER TABLE channel_tasks
      ADD CONSTRAINT channel_tasks_status_check
      CHECK (status IN ('todo', 'in_progress', 'done'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS channel_tasks_conversation_status_idx
  ON channel_tasks (conversation_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS channel_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructions TEXT,
  questions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_score NUMERIC(6,2) NOT NULL DEFAULT 100,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS channel_assessments_conversation_idx
  ON channel_assessments (conversation_id, published_at DESC);

CREATE TABLE IF NOT EXISTS channel_assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES channel_assessments(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  score NUMERIC(6,2),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS channel_assessment_attempts_lookup_idx
  ON channel_assessment_attempts (assessment_id, learner_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS learner_baseline_assessments (
  learner_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT,
  grade INT,
  score_percent NUMERIC(5,2) NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'medium',
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'learner_baseline_assessments_confidence_check'
  ) THEN
    ALTER TABLE learner_baseline_assessments
      ADD CONSTRAINT learner_baseline_assessments_confidence_check
      CHECK (confidence IN ('low', 'medium', 'high'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS learner_topic_mastery (
  learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  grade INT NOT NULL,
  topic_tag TEXT NOT NULL,
  mastery_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (learner_id, subject, grade, topic_tag)
);

CREATE INDEX IF NOT EXISTS learner_topic_mastery_lookup_idx
  ON learner_topic_mastery (learner_id, subject, grade, mastery_score ASC);

CREATE TABLE IF NOT EXISTS guardian_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  learner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relation TEXT NOT NULL DEFAULT 'guardian',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE (guardian_user_id, learner_user_id)
);

CREATE INDEX IF NOT EXISTS guardian_links_learner_idx
  ON guardian_links (learner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS auth_login_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  risk_level TEXT NOT NULL DEFAULT 'info',
  reason TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'auth_login_alerts_risk_level_check'
  ) THEN
    ALTER TABLE auth_login_alerts
      ADD CONSTRAINT auth_login_alerts_risk_level_check
      CHECK (risk_level IN ('info', 'warn', 'high'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS auth_login_alerts_user_idx
  ON auth_login_alerts (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS feature_flags (
  flag_key TEXT PRIMARY KEY,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_percent INT NOT NULL DEFAULT 0,
  kill_switch BOOLEAN NOT NULL DEFAULT FALSE,
  allow_roles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'feature_flags_rollout_percent_check'
  ) THEN
    ALTER TABLE feature_flags
      ADD CONSTRAINT feature_flags_rollout_percent_check
      CHECK (rollout_percent >= 0 AND rollout_percent <= 100);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS feature_flag_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL REFERENCES feature_flags(flag_key) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  before_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feature_flag_audits_flag_idx
  ON feature_flag_audits (flag_key, created_at DESC);
