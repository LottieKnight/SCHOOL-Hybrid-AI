-- Add metadata column to auth_tokens for carrying a payload (e.g. new email for email_change tokens).
-- Also extend the token_type check to include email_change.
ALTER TABLE auth_tokens
  ADD COLUMN IF NOT EXISTS metadata text;

ALTER TABLE auth_tokens
  DROP CONSTRAINT IF EXISTS auth_tokens_token_type_check;

ALTER TABLE auth_tokens
  ADD CONSTRAINT auth_tokens_token_type_check
  CHECK (token_type IN ('email_verification', 'password_reset', 'email_change'));
