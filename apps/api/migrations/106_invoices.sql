-- 106_invoices.sql
-- Institutional billing + payment reconciliation (Phase 2.2).
--
-- Turns a quoted enterprise tier into an invoiceable line item and tracks
-- payments (EFT / PayFast) against it so finance can reconcile the deal to
-- cash. VAT is captured at line-item level (SA standard 15%).
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  number          TEXT NOT NULL UNIQUE,          -- e.g. SCH-2026-0001
  tier            TEXT NOT NULL
                  CHECK (tier IN ('E1','E2','E3','U1','U2','U3','G1')),
  billing_cycle   TEXT NOT NULL DEFAULT 'annual'
                  CHECK (billing_cycle IN ('monthly','semi_annual','annual','multi_year','custom')),
  license_seats   INTEGER NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'ZAR',
  description     TEXT NOT NULL DEFAULT '',
  net_amount_zar  NUMERIC(14,2) NOT NULL,
  vat_zar         NUMERIC(14,2) NOT NULL,
  gross_amount_zar NUMERIC(14,2) NOT NULL,
  amount_paid_zar NUMERIC(14,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','issued','paid','partially_paid','overdue','cancelled')),
  payment_method  TEXT NOT NULL DEFAULT 'eft'
                  CHECK (payment_method IN ('eft','payfast','card','manual')),
  -- PayFast / gateway references
  payment_provider_ref TEXT,                     -- PayFast pf_payment_id / merchant_ref
  -- dates
  issued_at       TIMESTAMPTZ,
  due_at          TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_institution_idx   ON invoices (institution_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invoices_status_idx        ON invoices (status);
CREATE INDEX IF NOT EXISTS invoices_number_idx        ON invoices (number);

-- Line items breakdown (e.g. tier licence + add-ons). Detail preserved for the
-- printed invoice / VAT 15% line.
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  quantity      INTEGER NOT NULL DEFAULT 1,
  unit_price_zar NUMERIC(14,2) NOT NULL,
  net_zar       NUMERIC(14,2) NOT NULL,
  vat_rate      NUMERIC(5,4) NOT NULL DEFAULT 0.1500
);

CREATE INDEX IF NOT EXISTS invoice_line_items_invoice_idx ON invoice_line_items (invoice_id);

-- Payments applied against an invoice (reconciliation ledger).
CREATE TABLE IF NOT EXISTS invoice_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount_zar    NUMERIC(14,2) NOT NULL,
  method        TEXT NOT NULL DEFAULT 'eft'
                CHECK (method IN ('eft','payfast','card','manual')),
  reference     TEXT,                              -- bank / PayFast reference
  provider_ref  TEXT,                              -- PayFast pf_payment_id
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','cleared','failed','refunded')),
  received_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_payments_invoice_idx ON invoice_payments (invoice_id);

-- Recompute invoice.status + amount_paid/paid_at from the payments ledger.
CREATE OR REPLACE FUNCTION reconcile_invoice(invoice_uuid UUID) RETURNS VOID AS $$
DECLARE
  paid NUMERIC;
  gross NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount_zar), 0) INTO paid
    FROM invoice_payments WHERE invoice_id = invoice_uuid AND status = 'cleared';
  SELECT gross_amount_zar INTO gross FROM invoices WHERE id = invoice_uuid;

  UPDATE invoices SET
    amount_paid_zar = paid,
    status = CASE
      WHEN status = 'cancelled' THEN 'cancelled'
      WHEN paid >= gross AND gross > 0 THEN 'paid'
      WHEN paid > 0 THEN 'partially_paid'
      WHEN due_at IS NOT NULL AND due_at < now() THEN 'overdue'
      ELSE status
    END,
    paid_at = CASE WHEN paid >= gross AND gross > 0 THEN COALESCE(paid_at, now()) ELSE NULL END,
    updated_at = now()
  WHERE id = invoice_uuid;
END;
$$ LANGUAGE plpgsql;