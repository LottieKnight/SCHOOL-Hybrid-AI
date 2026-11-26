-- POPIA §§23–24 subject access request (DSAR) ledger.
--   §23 (access): a data subject may request a copy of their personal data.
--   §24 (erasure): a data subject may request correction or deletion of data.
-- Every request is recorded with a 30-day statutory response clock (POPIA §23(1).
-- The operator (DPO) manages fulfillment; erasure journals the anonymised/suspended
-- account so the outcome is auditable without deleting audit artifacts.

CREATE TABLE IF NOT EXISTS subject_access_requests (
  id                  TEXT PRIMARY KEY,
  requestor_user_id   UUID NOT NULL,            -- the data subject lodging the request
  institution_id      UUID,                     -- tenant, when the user is a member of one
  request_type        TEXT NOT NULL CHECK (request_type IN ('access', 'erasure')),
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','in_progress','fulfilled','rejected','erased')),
  details             TEXT,                      -- subject narrative / basis for request
  channel             TEXT DEFAULT 'self-service',
  sla_due_at          TIMESTAMPTZ NOT NULL,      -- statutory deadline (default +30d)
  snapshot_path       TEXT,                      -- where the §23 data package was staged
  fulfilled_at        TIMESTAMPTZ,
  fulfilled_by        UUID,                      -- operator (DPO) who closed the request
  fulfilled_notes     TEXT,
  erased_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- An operator in a hurry wants the SLA deadline and open requests first.
CREATE INDEX IF NOT EXISTS idx_dsar_status_sla ON subject_access_requests(status, sla_due_at);
CREATE INDEX IF NOT EXISTS idx_dsar_requestor   ON subject_access_requests(requestor_user_id);
CREATE INDEX IF NOT EXISTS idx_dsar_institution ON subject_access_requests(institution_id);