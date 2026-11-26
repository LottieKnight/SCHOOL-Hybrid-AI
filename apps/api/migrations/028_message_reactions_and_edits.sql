ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS messages_deleted_idx
  ON messages (conversation_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'message_reactions_emoji_check'
  ) THEN
    ALTER TABLE message_reactions
      ADD CONSTRAINT message_reactions_emoji_check
      CHECK (char_length(TRIM(emoji)) BETWEEN 1 AND 16);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS message_reactions_message_idx
  ON message_reactions (message_id, emoji, created_at DESC);

CREATE INDEX IF NOT EXISTS message_reactions_conversation_idx
  ON message_reactions (conversation_id, created_at DESC);
