-- Audit trail for security-critical actions (auth, account, admin).
CREATE TABLE IF NOT EXISTS audit_log (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        REFERENCES users(id) ON DELETE SET NULL,
  actor_id      uuid        REFERENCES users(id) ON DELETE SET NULL,
  action        text        NOT NULL,
  resource_type text,
  resource_id   text,
  metadata      jsonb,
  ip_address    text,
  user_agent    text,
  created_at    timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_user_id_idx    ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS audit_log_actor_id_idx   ON audit_log (actor_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx     ON audit_log (action);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at DESC);
