-- Phase 1: Connections Foundation — notification consolidation
--
-- The web layer used to write to an ad-hoc runtime `notifications` table
-- while every consumer (bell, /notifications page) read `user_notifications`
-- (061_social_features.sql). Backfill any rows written into the orphan table,
-- then drop it when the current role owns it (the orphan is frequently owned
-- by `postgres`; if so it is left in place — empty and unreferenced).
-- Also index user_notifications by created_at for feed ordering when owned.

-- Backfill orphan rows into user_notifications (best-effort; titles derive
-- from the legacy type).
-- Backfill orphan rows into user_notifications (best-effort; titles derive
-- from the legacy type). Guarded because the legacy `notifications` table
-- was a runtime-created table never produced by a migration — on a fresh
-- database it simply does not exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    INSERT INTO user_notifications (user_id, title, message, link, type, is_read, created_at)
    SELECT
      n.user_id,
      CASE n.type
        WHEN 'answer_accepted' THEN 'Answer accepted!'
        WHEN 'same_question_resolved' THEN 'Your question was answered'
        WHEN 'comment_on_post' THEN 'New reply on your post'
        WHEN 'reaction_on_post' THEN 'New reaction'
        WHEN 'achievement_unlocked' THEN 'Achievement unlocked'
        WHEN 'weekly_wrap' THEN 'Your weekly wrap'
        ELSE 'Update'
      END,
      n.message,
      NULL,
      n.type,
      n.read_at IS NOT NULL,
      n.created_at
    FROM notifications n
    ON CONFLICT DO NOTHING;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'notifications' AND tableowner = current_user
  ) THEN
    EXECUTE 'DROP TABLE notifications';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'user_notifications' AND tableowner = current_user
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications (created_at DESC)';
  END IF;
END $$;
