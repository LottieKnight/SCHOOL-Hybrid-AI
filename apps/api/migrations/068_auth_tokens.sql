-- Secure tokens for email verification and password reset.
-- Raw token is never stored; only a SHA-256 hex digest is persisted.
CREATE TABLE IF NOT EXISTS auth_tokens (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    text        NOT NULL UNIQUE,
  token_type    text        NOT NULL CHECK (token_type IN ('email_verification', 'password_reset')),
  expires_at    timestamptz NOT NULL,
  used_at       timestamptz,
  created_at    timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_tokens_user_id_idx   ON auth_tokens (user_id);
CREATE INDEX IF NOT EXISTS auth_tokens_expires_at_idx ON auth_tokens (expires_at);
