-- 107_lti.sql
-- LTI 1.3 (IMS Global / 1EdTech) platform integration (Phase 2.3).
--
-- SCHOOL acts as the LTI **Tool**: an institutional LMS (Moodle, Sakai,
-- Canvas, Blackboard) launches a learner/resource-link request into SCHOOL,
-- which verifies the JWS-`JWT` against the platform's public JWKS and scopes
-- the learner to the context (course) the LMS opened.
--
-- Each enabled LMS is an "LTI registration" scoped to an institution.
CREATE TABLE IF NOT EXISTS lti_registrations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id       UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  issuer               TEXT NOT NULL,                    -- platform iss (e.g. https://lms.univ.ac.za)
  client_id            TEXT NOT NULL,
  platform_name        TEXT NOT NULL DEFAULT 'LMS',
  auth_login_url       TEXT NOT NULL,                    -- platform's OIDC login initiation (3rd-party)
  auth_token_url       TEXT NOT NULL,
  jwks_url             TEXT NOT NULL,                    -- platform public keys
  deployment_id        TEXT,                             -- optional; scope to a single LTI deployment
  tool_context         TEXT NOT NULL DEFAULT 'lesson',   -- SCHOOL surface opened on launch
  claim_nonce_ttl_sec  INTEGER NOT NULL DEFAULT 600,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_id, issuer, client_id)
);

CREATE INDEX IF NOT EXISTS lti_registrations_institution_idx ON lti_registrations (institution_id);

-- One-time use nonces/state for replay protection during the two-step launch.
CREATE TABLE IF NOT EXISTS lti_launch_states (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce      TEXT NOT NULL UNIQUE,
  state      TEXT NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lti_launch_states_nonce_idx ON lti_launch_states (nonce);

-- Completed launches (context resource_link) for analytics/audit.
CREATE TABLE IF NOT EXISTS lti_launch_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES lti_registrations(id) ON DELETE SET NULL,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  issuer        TEXT,
  client_id     TEXT,
  deployment_id TEXT,
  resource_link_id TEXT,
  context_title TEXT,
  roles_lis     TEXT,           -- LIS role string(s) mapped to school role
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lti_launch_events_institution_idx ON lti_launch_events (institution_id, created_at DESC);