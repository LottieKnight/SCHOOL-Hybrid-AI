-- POPIA §14 data retention support.
-- last_active_at is bumped on each successful login; used to identify
-- stale accounts for the scheduled anonymisation cron.
-- anonymized_at marks rows that have had their PII wiped; set by the cron.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anonymized_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_last_active_at
  ON users(last_active_at)
  WHERE last_active_at IS NOT NULL;
