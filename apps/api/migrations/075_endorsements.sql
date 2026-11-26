-- Academic endorsements (LinkedIn-like skill endorsements between users)
CREATE TABLE IF NOT EXISTS endorsements (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  endorser_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endorsee_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_label TEXT        NOT NULL CHECK (char_length(skill_label) BETWEEN 2 AND 60),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (endorser_id, endorsee_id, skill_label)
);

CREATE INDEX IF NOT EXISTS idx_endorsements_endorsee ON endorsements (endorsee_id);
CREATE INDEX IF NOT EXISTS idx_endorsements_endorser ON endorsements (endorser_id, endorsee_id);
