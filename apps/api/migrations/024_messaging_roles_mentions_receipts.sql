ALTER TABLE conversation_participants DROP CONSTRAINT IF EXISTS conversation_participants_role_check;

ALTER TABLE conversation_participants
  ADD CONSTRAINT conversation_participants_role_check
  CHECK (role IN ('member', 'tutor', 'student', 'owner', 'editor', 'viewer'));

ALTER TABLE conversation_user_settings
  ADD COLUMN IF NOT EXISTS mention_notifications BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS message_mentions (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS message_mentions_user_idx
  ON message_mentions (mentioned_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS message_mentions_conversation_idx
  ON message_mentions (conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS message_receipts (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS message_receipts_recipient_idx
  ON message_receipts (recipient_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS message_receipts_conversation_idx
  ON message_receipts (conversation_id, recipient_id, updated_at DESC);

