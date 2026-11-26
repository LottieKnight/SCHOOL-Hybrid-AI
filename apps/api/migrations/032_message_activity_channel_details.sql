DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'message_activity_events_event_type_check'
  ) THEN
    ALTER TABLE message_activity_events
      DROP CONSTRAINT message_activity_events_event_type_check;
  END IF;
END $$;

ALTER TABLE message_activity_events
  ADD CONSTRAINT message_activity_events_event_type_check
  CHECK (
    event_type IN (
      'message_pinned',
      'message_unpinned',
      'conversation_archived',
      'conversation_unarchived',
      'participant_added',
      'participant_removed',
      'participant_left',
      'channel_details_updated'
    )
  );
