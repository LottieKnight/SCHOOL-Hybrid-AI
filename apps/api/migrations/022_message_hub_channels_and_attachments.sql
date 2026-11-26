ALTER TABLE messages
  ALTER COLUMN body DROP NOT NULL;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS assignment_title TEXT,
  ADD COLUMN IF NOT EXISTS assignment_description TEXT,
  ADD COLUMN IF NOT EXISTS assignment_due_at TIMESTAMPTZ;

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_type_check;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_type_check
  CHECK (type IN ('group', 'direct', 'channel'));

CREATE TABLE IF NOT EXISTS message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  kind TEXT NOT NULL,
  duration_seconds NUMERIC(8,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'message_attachments_kind_check'
  ) THEN
    ALTER TABLE message_attachments
      ADD CONSTRAINT message_attachments_kind_check
      CHECK (kind IN ('file', 'image', 'video', 'audio'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS message_attachments_storage_idx ON message_attachments(storage_path);
CREATE INDEX IF NOT EXISTS message_attachments_message_idx ON message_attachments(message_id, created_at ASC);
CREATE INDEX IF NOT EXISTS message_attachments_conversation_idx ON message_attachments(conversation_id, created_at DESC);
