-- New registrations now receive an explicit 14-day trial (createUser sets
-- trial_started_at / trial_ends_at). Backfill any existing users who were
-- created after the original 004_trial_plan backfill and never got trial dates.
UPDATE users
SET
  trial_started_at = COALESCE(trial_started_at, NOW()),
  trial_ends_at = COALESCE(trial_ends_at, NOW() + INTERVAL '14 days'),
  plan_type = COALESCE(plan_type, 'trial'),
  plan_status = COALESCE(plan_status, 'trialing')
WHERE
  plan_status = 'trialing'
  AND (trial_ends_at IS NULL OR trial_started_at IS NULL);
