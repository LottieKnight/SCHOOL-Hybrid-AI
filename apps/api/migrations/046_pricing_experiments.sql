CREATE TABLE IF NOT EXISTS pricing_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  detailed_report_price_credits INTEGER NOT NULL CHECK (detailed_report_price_credits > 0),
  weekly_free_unlocks INTEGER NOT NULL CHECK (weekly_free_unlocks >= 0),
  bundle_structure_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by_admin UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS pricing_experiments_start_idx
  ON pricing_experiments (start_date DESC);

CREATE INDEX IF NOT EXISTS pricing_experiments_created_by_idx
  ON pricing_experiments (created_by_admin, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS pricing_experiments_single_active_idx
  ON pricing_experiments ((1))
  WHERE end_date IS NULL;
