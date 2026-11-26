-- POPIA §35 compliance: age verification and minor safeguards
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS date_of_birth       DATE,
  ADD COLUMN IF NOT EXISTS is_minor            BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS parental_consent_given_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parental_consent_token    TEXT;

-- Index for minor flag — used in tutor marketplace to gate in-person bookings
CREATE INDEX IF NOT EXISTS idx_users_is_minor ON users (is_minor) WHERE is_minor = TRUE;
