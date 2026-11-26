-- Referral codes: one per user, generated on demand
CREATE TABLE referral_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code        TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX referral_codes_user_id_idx ON referral_codes(user_id);
CREATE        INDEX referral_codes_code_idx    ON referral_codes(code);

-- Referrals: one row per new user, bonus_credited_at set immediately on successful registration
CREATE TABLE referrals (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id          UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  code                TEXT        NOT NULL,
  bonus_credited_at   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX referrals_referrer_id_idx ON referrals(referrer_id);
