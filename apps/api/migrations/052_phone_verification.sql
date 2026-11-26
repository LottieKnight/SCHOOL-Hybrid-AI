ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_number TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS is_phone_verified
    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS phone_verified_at
    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_phone
  ON users(phone_number)
  WHERE phone_number IS NOT NULL;
