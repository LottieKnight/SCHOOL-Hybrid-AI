-- Widen the plan_type check constraint to cover every PlanTier.
-- 004_trial_plan.sql only allowed ('trial','monthly','annual'), so every
-- PayFast subscription ITN for scholar/family/school (and bursary redemptions)
-- failed at updateUserPlan with:
--   new row for relation "users" violates check constraint "users_plan_type_check"
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_type_check;
ALTER TABLE users
  ADD CONSTRAINT users_plan_type_check
  CHECK (plan_type IN ('trial', 'free', 'monthly', 'annual', 'scholar', 'family', 'school', 'bursary'));
