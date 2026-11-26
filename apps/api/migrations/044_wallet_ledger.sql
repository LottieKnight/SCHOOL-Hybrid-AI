CREATE TABLE IF NOT EXISTS wallet_accounts (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance_credits BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (balance_credits >= 0)
);

CREATE INDEX IF NOT EXISTS wallet_accounts_created_idx
  ON wallet_accounts (created_at DESC);

CREATE TABLE IF NOT EXISTS wallet_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount_credits BIGINT NOT NULL,
  reason TEXT NOT NULL,
  ref_type TEXT,
  ref_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (type IN ('CREDIT', 'DEBIT')),
  CHECK (amount_credits > 0)
);

CREATE INDEX IF NOT EXISTS wallet_ledger_user_created_idx
  ON wallet_ledger_entries (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS wallet_ledger_ref_idx
  ON wallet_ledger_entries (ref_type, ref_id);

CREATE TABLE IF NOT EXISTS wallet_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_ref TEXT UNIQUE,
  amount_zar NUMERIC(12, 2) NOT NULL,
  credits_granted BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (amount_zar > 0),
  CHECK (credits_granted > 0),
  CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled'))
);

CREATE INDEX IF NOT EXISTS wallet_topups_user_created_idx
  ON wallet_topups (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS wallet_topups_status_created_idx
  ON wallet_topups (status, created_at DESC);

CREATE TABLE IF NOT EXISTS processed_webhook_events (
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider, event_id)
);

