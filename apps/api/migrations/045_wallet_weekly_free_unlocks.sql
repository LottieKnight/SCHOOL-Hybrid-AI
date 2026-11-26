CREATE TABLE IF NOT EXISTS wallet_free_unlock_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  week_start DATE NOT NULL,
  attempt_ref_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (feature_key <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS wallet_free_unlock_usage_weekly_idx
  ON wallet_free_unlock_usage (user_id, feature_key, week_start);

CREATE INDEX IF NOT EXISTS wallet_free_unlock_usage_feature_week_idx
  ON wallet_free_unlock_usage (feature_key, week_start DESC);

CREATE INDEX IF NOT EXISTS wallet_free_unlock_usage_user_created_idx
  ON wallet_free_unlock_usage (user_id, created_at DESC);
