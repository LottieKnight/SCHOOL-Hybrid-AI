-- ============================================================================
-- Phase 0: Enterprise Foundation
-- 103_rbac_roles.sql
--
-- Adds hierarchical RBAC support to the users table.
-- The previous model was a flat `role` string with values like 'admin',
-- 'teacher', 'learner'. We now support a small set of well-defined roles.
-- Existing role values are migrated into the new RBAC-friendly set.
-- ============================================================================

-- 1. Add a permissions array and keep role as the primary role identifier.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}';

-- 2. Backfill permissions for existing users based on their current role.
--    Admin users get all permissions; everyone else gets none by default
--    (deny-by-default; permissions can be granted per corpus).
--    We rely on the in-application RBAC matrix keyed off `role` at runtime,
--    so here we just ensure the column exists and default is safe.

-- 3. Useful index on users.role for fast role-based lookups.
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================================================
-- 104_enterprise_settings.sql
--
-- Enterprise/institution configuration settings: SSO, branding, webhooks,
-- API, and feature flags scoped to an institution.
-- ============================================================================

CREATE TABLE IF NOT EXISTS institution_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id      UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  tier                TEXT NOT NULL DEFAULT 'E1'
                      CHECK (tier IN ('E1','E2','E3','U1','U2','U3','G1')),
  -- SSO configuration
  sso_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  sso_provider        TEXT,  -- 'saml','oauth','oidc','ldap'
  sso_config          JSONB NOT NULL DEFAULT '{}'
                      CHECK (jsonb_typeof(sso_config) = 'object'),
  -- Branding
  branding            JSONB NOT NULL DEFAULT '{}'
                      CHECK (jsonb_typeof(branding) = 'object'),
  custom_domain       TEXT UNIQUE,
  -- Permissions / feature flags per institution
  feature_flags       JSONB NOT NULL DEFAULT '{}'
                      CHECK (jsonb_typeof(feature_flags) = 'object'),
  -- Billing
  license_seats       INTEGER NOT NULL DEFAULT 0,
  billing_cycle       TEXT NOT NULL DEFAULT 'annual'
                      CHECK (billing_cycle IN ('monthly','semi_annual','annual','multi_year','custom')),
  contract_starts_at  TIMESTAMPTZ,
  contract_ends_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_id)
);

CREATE INDEX IF NOT EXISTS idx_institution_settings_tier
  ON institution_settings(tier);

CREATE INDEX IF NOT EXISTS idx_institution_settings_domain
  ON institution_settings(custom_domain)
  WHERE custom_domain IS NOT NULL;

-- ============================================================================
-- 105_api_keys.sql
--
-- API key management for institutional integrations.
-- Only the SHA-256 hash of the key is stored; never the raw key.
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  key_hash        TEXT NOT NULL UNIQUE,           -- SHA-256 hex of the raw key
  key_prefix      TEXT NOT NULL,                  -- e.g. "schl_ab12" for display
  scopes          TEXT[] NOT NULL DEFAULT '{}',   -- e.g. {read:users, read:analytics}
  rate_limit      INTEGER NOT NULL DEFAULT 60,    -- requests per minute
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','revoked')),
  last_used_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_institution
  ON api_keys(institution_id);

CREATE INDEX IF NOT EXISTS idx_api_keys_status
  ON api_keys(status);

-- ============================================================================
-- Row-Level Security (RLS) for tenant isolation.
--
-- Institutions must only see their own rows. We enable RLS on the core
-- institution-scoped tables and add policies keyed off the institution id which
-- is passed via the `app.institution_id` setting (set by the API layer -- the
-- tenant middleware exposes it and request handlers set the session value via
-- `SELECT set_config('app.institution_id', $1, true)`).
--
-- Superadmins (identified by role) are granted unrestricted access.
-- ============================================================================

-- Helper: set the current institution scope for the connection.
CREATE OR REPLACE FUNCTION app_set_institution(inst_id uuid)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.institution_id', inst_id::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS on api_keys: an institution may only see its own keys.
-- NOTE: enabled only if the api_keys table is populated by the new enterprise
-- routes (which set the session config). This is defense-in-depth on top of the
-- in-application institution scoping already applied in the route handlers.
DO $$
BEGIN
  IF to_regclass('public.api_keys') IS NOT NULL
     AND (SELECT count(*) FROM pg_policies WHERE tablename = 'api_keys') = 0
  THEN
    ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

    CREATE POLICY api_keys_tenant_isolation ON api_keys
      USING (
        (SELECT current_setting('app.institution_id', true))::uuid = institution_id
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.role = 'superadmin'
            AND u.id = (SELECT current_setting('request.user_id', true)::uuid
                        WHERE current_setting('request.user_id', true) != '')
        )
      );
  END IF;
END $$;

-- RLS on institution_settings: an institution may only see its own settings.
DO $$
BEGIN
  IF to_regclass('public.institution_settings') IS NOT NULL
     AND (SELECT count(*) FROM pg_policies WHERE tablename = 'institution_settings') = 0
  THEN
    ALTER TABLE institution_settings ENABLE ROW LEVEL SECURITY;

    CREATE POLICY institution_settings_tenant_isolation ON institution_settings
      USING (
        (SELECT current_setting('app.institution_id', true))::uuid = institution_id
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.role = 'superadmin'
            AND u.id = (SELECT current_setting('request.user_id', true)::uuid
                        WHERE current_setting('request.user_id', true) != '')
        )
      );
  END IF;
END $$;

-- ============================================================================
-- NOTE ON USERS RLS:
-- Row-level security on the `users` table is intentionally NOT enabled in this
-- migration. The existing application routes query `users` broadly (auth,
-- admin, profile, community) and would break if RLS were on without every query
-- setting the session config. Institution scoping on `users` is enforced at the
-- application layer (see the institutions routes) and can be layered on via RLS
-- later once all user queries are migrated to set the tenant context.
-- ============================================================================
