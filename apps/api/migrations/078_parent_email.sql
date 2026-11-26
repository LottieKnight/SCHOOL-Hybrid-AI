-- Stores the parent/guardian email collected at registration for minors.
-- Used to re-send the parental consent email if needed.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS parent_email TEXT;
