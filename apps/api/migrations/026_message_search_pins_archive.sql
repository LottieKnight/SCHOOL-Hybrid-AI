ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS conversations_archived_idx
  ON conversations (archived_at)
  WHERE archived_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS messages_pinned_conversation_idx
  ON messages (conversation_id, pinned_at DESC)
  WHERE pinned_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS messages_body_tsv_idx
  ON messages
  USING GIN (to_tsvector('simple', COALESCE(body, '')));

