ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS parent_message_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_parent_message_fk'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT messages_parent_message_fk
      FOREIGN KEY (parent_message_id)
      REFERENCES messages(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_parent_message_not_self_check'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT messages_parent_message_not_self_check
      CHECK (parent_message_id IS NULL OR parent_message_id <> id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS messages_parent_message_idx
  ON messages (parent_message_id)
  WHERE parent_message_id IS NOT NULL;
