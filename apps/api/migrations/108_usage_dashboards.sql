-- 108_usage_dashboards.sql
-- Institutional usage + AI accounting (Phase 3).
--
-- Phase 1-2 wired integrations (SSO/SCIM/webhooks/invoicing/branding/LTI). This
-- migration adds the durable, per-institution usage telemetry those surfaces
-- need to render dashboards and prove value to contract holders:
--
--   1. institution_usage_daily — daily rollup (active users, logins, sessions,
--      content completions) for institutional time-series dashboards.
--   2. institution_ai_usage     — durable per-institution AI accounting (tokens,
--      cost, requests) so the AI tutor can be billed/analysed at tenant level
--      (replacing the Redis-only request counter with a write-audited ledger).

-- Daily usage rollup, upserted by the usage collector (one row per institution
-- per day). "active_users" counts users with any activity that day; "logins"
-- sums auth events; "ai_requests" is fed from the AI ledger.
CREATE TABLE IF NOT EXISTS institution_usage_daily (
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  day            DATE NOT NULL,
  active_users   INTEGER NOT NULL DEFAULT 0,
  logins         INTEGER NOT NULL DEFAULT 0,
  sessions       INTEGER NOT NULL DEFAULT 0,
  lesson_engagements INTEGER NOT NULL DEFAULT 0,
  ai_requests    INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (institution_id, day)
);

CREATE INDEX IF NOT EXISTS usage_daily_inst_day_idx ON institution_usage_daily (institution_id, day DESC);

-- Durable per-institution AI usage ledger. Each tutor call records tokens/cost
-- so dashboards and finance can see AI spend at tenant level over time.
CREATE TABLE IF NOT EXISTS institution_ai_usage (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  provider       TEXT NOT NULL DEFAULT 'openai',
  model          TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  purpose        TEXT NOT NULL DEFAULT 'tutor',
  prompt_tokens  INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens   INTEGER NOT NULL DEFAULT 0,
  cost_zar       NUMERIC(12,6) NOT NULL DEFAULT 0,
  performed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_usage_inst_time_idx ON institution_ai_usage (institution_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_inst_day_idx  ON institution_ai_usage (institution_id, performed_at);

-- Convenience: roll the AI ledger into the daily usage table (kept idempotent;
-- use for daily aggregation jobs regardless of collector cadence).
CREATE OR REPLACE FUNCTION roll_ai_usage_into_daily() RETURNS VOID AS $$
BEGIN
  INSERT INTO institution_usage_daily (institution_id, day, ai_requests, updated_at)
  SELECT au.institution_id, au.performed_at::date, count(*)::int, NOW()
  FROM institution_ai_usage au
  WHERE NOT EXISTS (
    SELECT 1 FROM institution_usage_daily d
    WHERE d.institution_id = au.institution_id AND d.day = au.performed_at::date
  )
  GROUP BY au.institution_id, au.performed_at::date
  ON CONFLICT (institution_id, day) DO UPDATE SET ai_requests = institution_usage_daily.ai_requests + EXCLUDED.ai_requests;
END;
$$ LANGUAGE plpgsql;

-- Injectable metric: total seats + onboarded users per institution, updated by
-- the collector / seed so dashboard endpoints read a single trusted number.
ALTER TABLE institution_settings
  ADD COLUMN IF NOT EXISTS onboarded_user_count INTEGER NOT NULL DEFAULT 0;

-- Per-institution AI tutor configuration (Phase 3.3): provider/model/flags and
-- optional rate limits. Typed by lib/ai-config.ts; free-form JSONB is sanitised
-- on write through the same library.
ALTER TABLE institution_settings
  ADD COLUMN IF NOT EXISTS ai_config JSONB NOT NULL DEFAULT '{}'
  CHECK (jsonb_typeof(ai_config) = 'object');