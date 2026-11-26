-- Extend study_circles with public/private, invite codes, description, member cap
ALTER TABLE study_circles
  ADD COLUMN IF NOT EXISTS description  TEXT,
  ADD COLUMN IF NOT EXISTS is_public    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS invite_code  TEXT,
  ADD COLUMN IF NOT EXISTS max_members  INT NOT NULL DEFAULT 20;

-- Generate invite codes for any existing circles that don't have one yet
UPDATE study_circles
   SET invite_code = encode(gen_random_bytes(6), 'hex')
 WHERE invite_code IS NULL;

ALTER TABLE study_circles ALTER COLUMN invite_code SET NOT NULL;
ALTER TABLE study_circles ADD CONSTRAINT study_circles_invite_code_unique UNIQUE (invite_code);
