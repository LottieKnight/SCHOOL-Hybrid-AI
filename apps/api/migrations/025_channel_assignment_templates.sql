ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS assignment_template JSONB;

CREATE INDEX IF NOT EXISTS conversations_assignment_template_idx
  ON conversations USING GIN (assignment_template)
  WHERE assignment_template IS NOT NULL;

