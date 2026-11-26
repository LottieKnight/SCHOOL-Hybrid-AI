ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verification_level TEXT NOT NULL DEFAULT 'none';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_verification_level_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_verification_level_check
      CHECK (verification_level IN ('none', 'basic', 'verified'));
  END IF;
END $$;
