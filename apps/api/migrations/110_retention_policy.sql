-- POPIA §14 data-retention policy registry.
-- Replaces the hard-coded retention windows in the data-retention cron with an
-- operator-manageable policy. Values that are NULL fall back to the documented
-- defaults (kept in code). Storing only the operator's overrides keeps a single
-- source of truth and an audit trail of changes.

CREATE TABLE IF NOT EXISTS retention_policies (
  policy_key            TEXT PRIMARY KEY,
  display_name          TEXT NOT NULL,
  policy_value_years    TEXT,                      -- years, minus 1 day applied
  effective_from        TIMESTAMPTZ DEFAULT NOW(),
  updated_by            UUID,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the documented defaults explicitly so the registry is never empty and the
-- DPO can see at a glance what the platform enforces.
INSERT INTO retention_policies (policy_key, display_name, policy_value_years) VALUES
  ('account.inactivity_anonymize_years', 'Verified accounts anonymised after inactivity', '3'),
  ('account.unverified_cleanup_years',   'Unverified accounts hard-deleted after',         '1'),
  ('ledger.financial_retention_years',   'Financial / audit ledgers retained (legal)',     '7')
ON CONFLICT (policy_key) DO NOTHING;