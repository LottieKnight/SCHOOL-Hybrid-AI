CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'friend_requests_status_check'
  ) THEN
    ALTER TABLE friend_requests
      ADD CONSTRAINT friend_requests_status_check
      CHECK (status IN ('pending', 'accepted', 'declined'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_unique_pair_idx
  ON friend_requests(requester_id, recipient_id);

CREATE INDEX IF NOT EXISTS friend_requests_recipient_idx
  ON friend_requests(recipient_id);
