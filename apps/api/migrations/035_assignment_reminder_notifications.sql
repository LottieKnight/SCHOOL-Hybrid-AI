CREATE TABLE IF NOT EXISTS assignment_reminder_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  reminder_kind TEXT NOT NULL,
  assignment_title TEXT,
  assignment_due_at TIMESTAMPTZ NOT NULL,
  source_sent_at TIMESTAMPTZ NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, conversation_id, reminder_kind, assignment_due_at)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assignment_reminder_notifications_kind_check'
  ) THEN
    ALTER TABLE assignment_reminder_notifications
      ADD CONSTRAINT assignment_reminder_notifications_kind_check
      CHECK (reminder_kind IN ('72h', '24h', 'overdue'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS assignment_reminder_notifications_unread_idx
  ON assignment_reminder_notifications (user_id, read_at, created_at DESC);

CREATE INDEX IF NOT EXISTS assignment_reminder_notifications_conversation_idx
  ON assignment_reminder_notifications (conversation_id, created_at DESC);
