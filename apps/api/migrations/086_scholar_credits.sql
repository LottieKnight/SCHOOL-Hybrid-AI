-- Scholar Credits — the unified cross-venture economy (Ludo Principle).
--
-- One ledger for every Ditshego venture: SCHOOL, AURA, SPHERE, NPC, ROCKIT,
-- SCENE, LOGISTICS, V4NTAG3. A student earns in one venture and spends in
-- another; the ledger is the connective tissue.
--
-- Design notes:
--   * Users keep a denormalised running total on `users` for cheap balance
--     reads (leaderboards, headers); the wallets + transaction log are the
--     authoritative store and are written inside one transaction.
--   * Every mutation is idempotency-keyed (partial unique index) so offline
--     PWA retries can never double-earn or double-spend.
--   * Rate limits are per (user, venture, source, window) so no source can be
--     farmed. Streaks are stored per (user, venture, type).
--   * Enumerated values are stored UPPER_SNAKE to mirror the TypeScript
--     contracts in prototypes/scholar-credits/types.ts exactly — no
--     case-mapping bugs across the ecosystem.
--   * POPIA: audit log keeps only a salted IP hash and a coarse browser
--     family (same pattern as migration 082), never raw IPs or user agents.

-- 1. Users — running totals --------------------------------------------------
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS credits_balance INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS lifetime_earned INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS lifetime_spent INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS longest_streak INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_active_date DATE,
    ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'en',
    ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Africa/Johannesburg';

-- 2. Credit wallets (per user per venture) -----------------------------------
CREATE TABLE IF NOT EXISTS credit_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    venture TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 0,
    locked INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_credit_wallets_user_venture UNIQUE (user_id, venture),
    CONSTRAINT ck_credit_wallets_venture CHECK (venture IN (
        'SCHOOL', 'AURA', 'SPHERE', 'NPC', 'ROCKIT', 'SCENE', 'LOGISTICS', 'V4NTAG3', 'DITSHGO_VENTURES'
    )),
    CONSTRAINT ck_credit_wallets_balance CHECK (balance >= 0),
    CONSTRAINT ck_credit_wallets_locked CHECK (locked >= 0)
);

CREATE INDEX IF NOT EXISTS idx_credit_wallets_venture ON credit_wallets(venture);

-- 3. Credit transactions — the authoritative ledger --------------------------
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES credit_wallets(id) ON DELETE SET NULL,
    venture TEXT NOT NULL,
    type TEXT NOT NULL,
    source TEXT NOT NULL,
    amount INTEGER NOT NULL,
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key TEXT,
    reference_id TEXT,
    reference_type TEXT,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_credit_transactions_venture CHECK (venture IN (
        'SCHOOL', 'AURA', 'SPHERE', 'NPC', 'ROCKIT', 'SCENE', 'LOGISTICS', 'V4NTAG3', 'DITSHGO_VENTURES'
    )),
    CONSTRAINT ck_credit_transactions_type CHECK (type IN (
        'EARN', 'SPEND', 'TRANSFER_IN', 'TRANSFER_OUT', 'BONUS', 'PENALTY', 'REFUND', 'ADJUSTMENT'
    )),
    CONSTRAINT ck_credit_transactions_amount CHECK (amount <> 0),
    CONSTRAINT ck_credit_transactions_balance CHECK (balance_after = balance_before + amount)
);

-- Idempotency: one key may only ever resolve to one transaction.
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_transactions_idempotency
    ON credit_transactions(idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_venture ON credit_transactions(venture, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_source ON credit_transactions(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_ref ON credit_transactions(reference_id, reference_type);

-- 4. Streaks (per user per venture per type) ---------------------------------
CREATE TABLE IF NOT EXISTS credit_streaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    venture TEXT NOT NULL,
    streak_type TEXT NOT NULL DEFAULT 'daily',
    count INTEGER NOT NULL DEFAULT 0,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_streaks_user ON credit_streaks(user_id, venture);
CREATE INDEX IF NOT EXISTS idx_credit_streaks_active ON credit_streaks(is_active);

-- 5. Venture profiles — the Ludo link table (one identity, many ventures) ----
CREATE TABLE IF NOT EXISTS credit_venture_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    venture TEXT NOT NULL,
    external_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_credit_venture_profiles_user_venture UNIQUE (user_id, venture)
);

CREATE INDEX IF NOT EXISTS idx_credit_venture_profiles_venture ON credit_venture_profiles(venture);
CREATE INDEX IF NOT EXISTS idx_credit_venture_profiles_external ON credit_venture_profiles(external_id);

-- 6. Redemptions — spending credits on real things ---------------------------
CREATE TABLE IF NOT EXISTS credit_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    venture TEXT NOT NULL,
    source TEXT NOT NULL,
    amount INTEGER NOT NULL,
    item_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    item_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_credit_redemptions_amount CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_credit_redemptions_user ON credit_redemptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_redemptions_status ON credit_redemptions(status);

-- 7. Rate limits — anti-farming per (user, venture, source, window) ----------
CREATE TABLE IF NOT EXISTS credit_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    venture TEXT NOT NULL,
    source TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    max_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_credit_rate_limits_window UNIQUE (user_id, venture, source, window_start),
    CONSTRAINT ck_credit_rate_limits_count CHECK (count >= 0 AND count <= max_count)
);

CREATE INDEX IF NOT EXISTS idx_credit_rate_limits_user ON credit_rate_limits(user_id, venture);

-- 8. Audit log — every economic mutation is reviewable ----------------------
CREATE TABLE IF NOT EXISTS credit_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    venture TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    performed_by TEXT,
    reason TEXT,
    ip_hash TEXT,                          -- salted hash, never the raw IP
    user_agent_family TEXT,                -- coarse browser family only
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_audit_log_user ON credit_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_audit_log_entity ON credit_audit_log(entity_type, entity_id);
