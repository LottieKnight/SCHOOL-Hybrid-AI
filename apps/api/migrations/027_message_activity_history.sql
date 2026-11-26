CREATE TABLE IF NOT EXISTS message_activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'message_activity_events_event_type_check'
  ) THEN
    ALTER TABLE message_activity_events
      ADD CONSTRAINT message_activity_events_event_type_check
      CHECK (
        event_type IN (
          'message_pinned',
          'message_unpinned',
          'conversation_archived',
          'conversation_unarchived'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS message_activity_events_conversation_idx
  ON message_activity_events (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS message_activity_events_message_idx
  ON message_activity_events (message_id, created_at DESC)
  WHERE message_id IS NOT NULL;

