CREATE TABLE IF NOT EXISTS bookstore_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  url TEXT,
  is_commercial_allowed BOOLEAN NOT NULL,
  is_derivative_allowed BOOLEAN NOT NULL,
  requires_sharealike BOOLEAN NOT NULL,
  requires_attribution BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_licenses_type_check') THEN
    ALTER TABLE bookstore_licenses
      ADD CONSTRAINT bookstore_licenses_type_check
      CHECK (
        type IN (
          'CC_BY',
          'CC_BY_SA',
          'CC_BY_ND',
          'CC_BY_NC',
          'CC_BY_NC_SA',
          'CC_BY_NC_ND',
          'PUBLIC_DOMAIN',
          'ALL_RIGHTS_RESERVED',
          'OTHER'
        )
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS bookstore_licenses_type_url_uidx
  ON bookstore_licenses (type, COALESCE(url, ''));

INSERT INTO bookstore_licenses (
  type,
  url,
  is_commercial_allowed,
  is_derivative_allowed,
  requires_sharealike,
  requires_attribution
)
SELECT
  p.license_type,
  p.license_url,
  CASE WHEN p.license_type IN ('CC_BY_NC', 'CC_BY_NC_SA', 'CC_BY_NC_ND') THEN FALSE ELSE TRUE END,
  CASE WHEN p.license_type IN ('CC_BY_ND', 'CC_BY_NC_ND') THEN FALSE ELSE TRUE END,
  CASE WHEN p.license_type IN ('CC_BY_SA', 'CC_BY_NC_SA') THEN TRUE ELSE FALSE END,
  CASE
    WHEN p.license_type IN (
      'CC_BY',
      'CC_BY_SA',
      'CC_BY_ND',
      'CC_BY_NC',
      'CC_BY_NC_SA',
      'CC_BY_NC_ND'
    ) THEN TRUE
    ELSE FALSE
  END
FROM (
  SELECT DISTINCT license_type, license_url
  FROM bookstore_products
) p
ON CONFLICT DO NOTHING;

ALTER TABLE bookstore_products
  ADD COLUMN IF NOT EXISTS license_id UUID REFERENCES bookstore_licenses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES bookstore_suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_mode TEXT,
  ADD COLUMN IF NOT EXISTS pod_spec_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pod_base_cost_cents INTEGER,
  ADD COLUMN IF NOT EXISTS target_margin_rate NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS vat_inclusive BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_excerpt BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_partial_product BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE bookstore_products p
SET license_id = l.id
FROM bookstore_licenses l
WHERE p.license_id IS NULL
  AND l.type = p.license_type
  AND COALESCE(l.url, '') = COALESCE(p.license_url, '');

UPDATE bookstore_products
SET delivery_mode = CASE
  WHEN fulfillment_type = 'LINK_ONLY' THEN 'LINK_ONLY'
  WHEN fulfillment_type = 'FILE_DOWNLOAD' THEN 'FILE_DOWNLOAD'
  ELSE delivery_mode
END
WHERE delivery_mode IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_products_delivery_mode_check') THEN
    ALTER TABLE bookstore_products
      ADD CONSTRAINT bookstore_products_delivery_mode_check
      CHECK (delivery_mode IS NULL OR delivery_mode IN ('LINK_ONLY', 'FILE_DOWNLOAD'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_products_pod_base_cost_check') THEN
    ALTER TABLE bookstore_products
      ADD CONSTRAINT bookstore_products_pod_base_cost_check
      CHECK (pod_base_cost_cents IS NULL OR pod_base_cost_cents >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_products_target_margin_rate_check') THEN
    ALTER TABLE bookstore_products
      ADD CONSTRAINT bookstore_products_target_margin_rate_check
      CHECK (target_margin_rate IS NULL OR (target_margin_rate >= 0 AND target_margin_rate < 0.95));
  END IF;
END $$;

ALTER TABLE bookstore_suppliers
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS terms_url TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE bookstore_suppliers
SET supplier_type = 'POD_PRINTER'
WHERE supplier_type = 'POD';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_suppliers_supplier_type_check') THEN
    ALTER TABLE bookstore_suppliers
      DROP CONSTRAINT bookstore_suppliers_supplier_type_check;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_suppliers_supplier_type_check') THEN
    ALTER TABLE bookstore_suppliers
      ADD CONSTRAINT bookstore_suppliers_supplier_type_check
      CHECK (
        supplier_type IN (
          'OER_PROVIDER',
          'POD_PRINTER',
          'WHOLESALER',
          'PUBLISHER_DIRECT',
          'PLATFORM_PARTNER'
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS bookstore_download_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES bookstore_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES bookstore_products(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_download_tokens_uses_check') THEN
    ALTER TABLE bookstore_download_tokens
      ADD CONSTRAINT bookstore_download_tokens_uses_check
      CHECK (max_uses >= 1 AND used_count >= 0 AND used_count <= max_uses);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bookstore_download_tokens_lookup_idx
  ON bookstore_download_tokens (token, expires_at);
CREATE INDEX IF NOT EXISTS bookstore_download_tokens_order_product_idx
  ON bookstore_download_tokens (order_id, product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bookstore_supplier_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES bookstore_suppliers(id) ON DELETE SET NULL,
  supplier_type TEXT NOT NULL,
  import_format TEXT NOT NULL DEFAULT 'CSV',
  status TEXT NOT NULL DEFAULT 'queued',
  source_ref TEXT,
  result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_supplier_import_jobs_status_check') THEN
    ALTER TABLE bookstore_supplier_import_jobs
      ADD CONSTRAINT bookstore_supplier_import_jobs_status_check
      CHECK (status IN ('queued', 'running', 'completed', 'failed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_supplier_import_jobs_format_check') THEN
    ALTER TABLE bookstore_supplier_import_jobs
      ADD CONSTRAINT bookstore_supplier_import_jobs_format_check
      CHECK (import_format IN ('CSV', 'ONIX', 'MANUAL'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bookstore_supplier_import_jobs_created_idx
  ON bookstore_supplier_import_jobs (created_at DESC);
