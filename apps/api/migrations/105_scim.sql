-- 105_scim.sql
-- SCIM 2.0 (RFC 7643/7644) provisioning support.
--
-- Adds an idempotency key column to users so a SCIM source of truth (Azure AD,
-- Okta, Google Workspace) can create/update/delete users deterministically via
-- the standard /scim/v2 endpoints, keyed on each IdP's opaque externalId.
--
-- Uniqueness of externalId is enforced within a single institution (the SCIM
-- tenant) so two institutions can independently provision users without the
-- global email unique constraint tripping on shared inboxes.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS external_id TEXT;

-- One source-of-truth key per institution; NULL external_id rows (non-SCIM
-- users) are excluded from the uniqueness guarantee.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_institution_external_id
  ON users (institution_id, external_id)
  WHERE external_id IS NOT NULL;

-- Provisioning events log for audit / reconciliation (who pushed what, when).
CREATE TABLE IF NOT EXISTS scim_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  operation text NOT NULL,              -- createUser / replaceUser / deleteUser ...
  resource_type text NOT NULL DEFAULT 'User',
  external_id text,
  user_id uuid,
  payload jsonb,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scim_events_institution_idx
  ON scim_events (institution_id, created_at DESC);

-- SCIM groups: cross-domain group membership used to derive SCHOOL roles
-- (e.g. an "Administrators"/"Educators" group maps to the respective role).
CREATE TABLE IF NOT EXISTS scim_groups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  external_id text NOT NULL,            -- SCIM group id from the IdP
  display_name text NOT NULL,
  created_at timestamptz DEFAULT NOW(),
  UNIQUE (institution_id, external_id)
);

CREATE TABLE IF NOT EXISTS scim_group_members (
  group_id uuid NOT NULL REFERENCES scim_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);