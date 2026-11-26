ALTER TABLE conversation_user_settings
  ADD COLUMN IF NOT EXISTS assignment_reminder_snoozed_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assignment_overdue_repeat_hours INTEGER NOT NULL DEFAULT 24;

UPDATE conversation_user_settings
SET assignment_overdue_repeat_hours = 24
WHERE assignment_overdue_repeat_hours IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversation_user_settings_assignment_overdue_repeat_hours_check'
  ) THEN
    ALTER TABLE conversation_user_settings
      ADD CONSTRAINT conversation_user_settings_assignment_overdue_repeat_hours_check
      CHECK (assignment_overdue_repeat_hours BETWEEN 6 AND 168);
  END IF;
END $$;

ALTER TABLE assignment_reminder_deliveries
  ADD COLUMN IF NOT EXISTS overdue_repeat_hours_snapshot INTEGER NOT NULL DEFAULT 24;

UPDATE assignment_reminder_deliveries
SET overdue_repeat_hours_snapshot = 24
WHERE overdue_repeat_hours_snapshot IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assignment_reminder_deliveries_overdue_repeat_hours_snapshot_check'
  ) THEN
    ALTER TABLE assignment_reminder_deliveries
      ADD CONSTRAINT assignment_reminder_deliveries_overdue_repeat_hours_snapshot_check
      CHECK (overdue_repeat_hours_snapshot BETWEEN 6 AND 168);
  END IF;
END $$;
