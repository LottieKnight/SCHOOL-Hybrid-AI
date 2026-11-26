-- Sponsor-seat / bursary redemption codes.
-- Distinct from the external-funding "bursaries" discovery feature: these codes let a
-- sponsor (NPO, school, bursary fund) grant a learner a fully-sponsored SCHOOL seat
-- (plan_type = 'bursary', full Scholar-equivalent access at R0 to the learner).
-- Idempotent-safe: re-running inserts nothing because codes are pre-generated with
-- explicit UUIDs by the issuer; this DDL only creates the table if absent.

CREATE TABLE IF NOT EXISTS bursary_codes (
  code TEXT PRIMARY KEY,
  sponsor_name TEXT NOT NULL,
  sponsor_email TEXT,
  seats_total INTEGER NOT NULL DEFAULT 1,
  seats_redeemed INTEGER NOT NULL DEFAULT 0,
  plan_tier TEXT NOT NULL DEFAULT 'bursary',
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS bursary_code_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL REFERENCES bursary_codes(code) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  plan_expires_at TIMESTAMPTZ,
  UNIQUE (code, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bursary_code_redemptions_user ON bursary_code_redemptions(user_id);
