ALTER TABLE conversation_user_settings
  ADD COLUMN IF NOT EXISTS channel_event_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS message_update_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS share_presence BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS share_typing BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS share_read_receipts BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE conversation_user_settings
SET
  channel_event_notifications = TRUE
WHERE channel_event_notifications IS NULL;

UPDATE conversation_user_settings
SET
  message_update_notifications = TRUE
WHERE message_update_notifications IS NULL;

UPDATE conversation_user_settings
SET
  share_presence = TRUE
WHERE share_presence IS NULL;

UPDATE conversation_user_settings
SET
  share_typing = TRUE
WHERE share_typing IS NULL;

UPDATE conversation_user_settings
SET
  share_read_receipts = TRUE
WHERE share_read_receipts IS NULL;

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
      'channel_details_updated',
      'channel_reminder_settings_updated',
      'channel_notification_settings_updated'
    )
  );
