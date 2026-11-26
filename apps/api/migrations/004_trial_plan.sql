ALTER TABLE users
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS plan_status TEXT NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;

UPDATE users
SET
  trial_started_at = COALESCE(trial_started_at, NOW()),
  trial_ends_at = COALESCE(trial_ends_at, NOW() + INTERVAL '14 days'),
  plan_type = COALESCE(plan_type, 'trial'),
  plan_status = COALESCE(plan_status, 'trialing')
WHERE
  trial_started_at IS NULL
  OR trial_ends_at IS NULL
  OR plan_type IS NULL
  OR plan_status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_plan_type_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_plan_type_check
      CHECK (plan_type IN ('trial', 'monthly', 'annual'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_plan_status_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_plan_status_check
      CHECK (plan_status IN ('trialing', 'active', 'expired', 'canceled'));
  END IF;
END $$;
