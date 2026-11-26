ALTER TABLE conversation_user_settings
  ADD COLUMN IF NOT EXISTS assignment_reminder_mode TEXT NOT NULL DEFAULT '72h';

UPDATE conversation_user_settings
SET assignment_reminder_mode = '72h'
WHERE assignment_reminder_mode IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversation_user_settings_assignment_reminder_mode_check'
  ) THEN
    ALTER TABLE conversation_user_settings
      ADD CONSTRAINT conversation_user_settings_assignment_reminder_mode_check
      CHECK (assignment_reminder_mode IN ('off', '72h', '24h'));
  END IF;
END $$;
