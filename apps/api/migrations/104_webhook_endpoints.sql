-- 104_webhook_endpoints.sql
-- Enterprise outbound webhooks: institutions register endpoints to receive
-- events (e.g. user.synced, school.created). Payloads are HMAC-SHA256 signed
-- with per-endpoint secrets and delivered via BullMQ with retries.
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text NOT NULL,                -- raw secret used to sign payloads (HMAC)
  events text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT TRUE,
  last_delivered_at timestamptz,
  last_status_code int,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhook_endpoints_institution_idx ON webhook_endpoints (institution_id);

-- Outbound delivery log for auditability / troubleshooting.
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint_id uuid NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb,
  attempt int NOT NULL DEFAULT 1,
  status_code int,
  response_body text,
  success boolean NOT NULL DEFAULT FALSE,
  delivered_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhook_deliveries_endpoint_idx ON webhook_deliveries (endpoint_id, delivered_at DESC);

-- RLS: institution admins and their service accounts may manage endpoints.
-- Uses the `app.institution_id` session setting set by the tenant middleware,
-- matching the pattern in 103_rbac_roles.sql.
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_endpoints_tenant_isolation
  ON webhook_endpoints
  USING (
    (SELECT current_setting('app.institution_id', true))::uuid = institution_id
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.role = 'superadmin'
        AND u.id = (SELECT current_setting('request.user_id', true)::uuid
                    WHERE current_setting('request.user_id', true) != '')
    )
  );

CREATE POLICY webhook_deliveries_tenant_isolation
  ON webhook_deliveries
  USING (
    EXISTS (
      SELECT 1 FROM webhook_endpoints e
      WHERE e.id = webhook_deliveries.endpoint_id
        AND (SELECT current_setting('app.institution_id', true))::uuid = e.institution_id
    )
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.role = 'superadmin'
        AND u.id = (SELECT current_setting('request.user_id', true)::uuid
                    WHERE current_setting('request.user_id', true) != '')
    )
  );

-- Note: webhook delivery workers insert/read deliveries as the app's superuser
-- (bypassing RLS) or as a role that sets app_institution_id appropriately.
