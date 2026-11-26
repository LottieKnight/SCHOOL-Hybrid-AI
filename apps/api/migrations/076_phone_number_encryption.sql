-- Migrate phone_number from plaintext TEXT UNIQUE to AES-256-GCM ciphertext.
-- Uniqueness is enforced via phone_number_hash (HMAC-SHA256) instead of the raw value.

-- 1. Add the hash column that carries the UNIQUE constraint.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_number_hash TEXT;

-- 2. Drop the old unique index and inline unique constraint on the plaintext column.
--    Ciphertext produced with a random IV cannot be unique-constrained directly.
DROP INDEX IF EXISTS idx_users_phone;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_number_key;

-- 3. Apply uniqueness to the hash column.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_number_hash
  ON users(phone_number_hash)
  WHERE phone_number_hash IS NOT NULL;

-- NOTE: Existing rows with a plaintext phone_number must be re-encrypted by the
-- one-time script: apps/web/scripts/encrypt-existing-phone-numbers.ts
-- Run it immediately after applying this migration and before the next deploy.
