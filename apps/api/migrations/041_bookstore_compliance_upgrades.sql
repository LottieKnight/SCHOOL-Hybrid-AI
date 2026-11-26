ALTER TABLE bookstore_products
  ADD COLUMN IF NOT EXISTS adapted_license_type TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_products_adapted_license_type_check') THEN
    ALTER TABLE bookstore_products
      ADD CONSTRAINT bookstore_products_adapted_license_type_check
      CHECK (
        adapted_license_type IS NULL
        OR adapted_license_type IN (
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

CREATE TABLE IF NOT EXISTS bookstore_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  supplier_type TEXT NOT NULL,
  provider_code TEXT NOT NULL UNIQUE,
  contact_email TEXT,
  api_base_url TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_suppliers_supplier_type_check') THEN
    ALTER TABLE bookstore_suppliers
      ADD CONSTRAINT bookstore_suppliers_supplier_type_check
      CHECK (supplier_type IN ('OER_PROVIDER', 'WHOLESALER', 'PUBLISHER_DIRECT', 'POD'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bookstore_suppliers_type_idx ON bookstore_suppliers(supplier_type, is_active);
