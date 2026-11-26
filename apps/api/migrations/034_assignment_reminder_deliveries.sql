CREATE TABLE IF NOT EXISTS assignment_reminder_deliveries (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminder_kind TEXT NOT NULL,
  assignment_due_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id, reminder_kind, assignment_due_at)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assignment_reminder_deliveries_kind_check'
  ) THEN
    ALTER TABLE assignment_reminder_deliveries
      ADD CONSTRAINT assignment_reminder_deliveries_kind_check
      CHECK (reminder_kind IN ('72h', '24h', 'overdue'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS assignment_reminder_deliveries_user_idx
  ON assignment_reminder_deliveries (user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS assignment_reminder_deliveries_sent_idx
  ON assignment_reminder_deliveries (sent_at DESC);
