CREATE TABLE IF NOT EXISTS bookstore_shipping_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  rules_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookstore_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  phase TEXT NOT NULL,
  grade_min INTEGER NOT NULL,
  grade_max INTEGER NOT NULL,
  subjects TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  format TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  is_free BOOLEAN GENERATED ALWAYS AS (price_cents = 0) STORED,
  license_type TEXT NOT NULL,
  license_url TEXT,
  attribution_html TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  source_provider TEXT NOT NULL,
  nd_no_derivatives BOOLEAN GENERATED ALWAYS AS (
    license_type IN ('CC_BY_ND', 'CC_BY_NC_ND')
  ) STORED,
  nc_noncommercial BOOLEAN GENERATED ALWAYS AS (
    license_type IN ('CC_BY_NC', 'CC_BY_NC_SA', 'CC_BY_NC_ND')
  ) STORED,
  sa_sharealike BOOLEAN GENERATED ALWAYS AS (
    license_type IN ('CC_BY_SA', 'CC_BY_NC_SA')
  ) STORED,
  is_adapted BOOLEAN NOT NULL DEFAULT FALSE,
  storage_key TEXT,
  file_type TEXT,
  file_size INTEGER,
  checksum TEXT,
  external_download_url TEXT,
  fulfillment_type TEXT NOT NULL,
  shipping_profile_id UUID REFERENCES bookstore_shipping_profiles(id),
  stock_qty INTEGER,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_products_phase_check') THEN
    ALTER TABLE bookstore_products
      ADD CONSTRAINT bookstore_products_phase_check
      CHECK (phase IN ('FOUNDATION', 'INTERMEDIATE', 'SENIOR', 'FET'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_products_grade_range_check') THEN
    ALTER TABLE bookstore_products
      ADD CONSTRAINT bookstore_products_grade_range_check
      CHECK (grade_min >= 0 AND grade_max <= 12 AND grade_min <= grade_max);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_products_format_check') THEN
    ALTER TABLE bookstore_products
      ADD CONSTRAINT bookstore_products_format_check
      CHECK (format IN ('DIGITAL', 'HARDCOPY', 'BUNDLE'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_products_price_check') THEN
    ALTER TABLE bookstore_products
      ADD CONSTRAINT bookstore_products_price_check
      CHECK (price_cents >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_products_license_type_check') THEN
    ALTER TABLE bookstore_products
      ADD CONSTRAINT bookstore_products_license_type_check
      CHECK (
        license_type IN (
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_products_source_provider_check') THEN
    ALTER TABLE bookstore_products
      ADD CONSTRAINT bookstore_products_source_provider_check
      CHECK (
        source_provider IN (
          'SIYAVULA',
          'AFRICAN_STORYBOOK',
          'STORYWEAVER',
          'OPENSTAX',
          'WHOLESALER',
          'PUBLISHER_DIRECT',
          'MANUAL'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_products_file_type_check') THEN
    ALTER TABLE bookstore_products
      ADD CONSTRAINT bookstore_products_file_type_check
      CHECK (file_type IS NULL OR file_type IN ('PDF', 'EPUB', 'ZIP', 'LINK_ONLY'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_products_fulfillment_type_check') THEN
    ALTER TABLE bookstore_products
      ADD CONSTRAINT bookstore_products_fulfillment_type_check
      CHECK (
        fulfillment_type IN ('LINK_ONLY', 'FILE_DOWNLOAD', 'PRINT_ON_DEMAND', 'SHIP_FROM_SUPPLIER')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bookstore_products_phase_idx ON bookstore_products(phase);
CREATE INDEX IF NOT EXISTS bookstore_products_grade_idx ON bookstore_products(grade_min, grade_max);
CREATE INDEX IF NOT EXISTS bookstore_products_active_idx ON bookstore_products(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS bookstore_products_license_idx ON bookstore_products(license_type);
CREATE INDEX IF NOT EXISTS bookstore_products_subjects_gin_idx ON bookstore_products USING GIN(subjects);
CREATE INDEX IF NOT EXISTS bookstore_products_tags_gin_idx ON bookstore_products USING GIN(tags);

CREATE TABLE IF NOT EXISTS bookstore_ingest_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_ingest_jobs_status_check') THEN
    ALTER TABLE bookstore_ingest_jobs
      ADD CONSTRAINT bookstore_ingest_jobs_status_check
      CHECK (status IN ('queued', 'running', 'completed', 'failed'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS bookstore_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  payment_provider TEXT,
  payment_intent_id TEXT,
  payment_status TEXT NOT NULL DEFAULT 'not_required',
  fulfillment_status TEXT NOT NULL DEFAULT 'pending',
  address_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_orders_status_check') THEN
    ALTER TABLE bookstore_orders
      ADD CONSTRAINT bookstore_orders_status_check
      CHECK (status IN ('pending', 'awaiting_payment', 'paid', 'canceled', 'fulfilled', 'failed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_orders_payment_status_check') THEN
    ALTER TABLE bookstore_orders
      ADD CONSTRAINT bookstore_orders_payment_status_check
      CHECK (payment_status IN ('not_required', 'pending', 'authorized', 'paid', 'failed', 'refunded'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_orders_fulfillment_status_check') THEN
    ALTER TABLE bookstore_orders
      ADD CONSTRAINT bookstore_orders_fulfillment_status_check
      CHECK (fulfillment_status IN ('pending', 'ready', 'fulfilled', 'canceled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bookstore_orders_user_idx ON bookstore_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookstore_orders_status_idx ON bookstore_orders(status, created_at DESC);

CREATE TABLE IF NOT EXISTS bookstore_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES bookstore_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES bookstore_products(id) ON DELETE SET NULL,
  product_slug TEXT,
  product_title TEXT NOT NULL,
  product_license_type TEXT NOT NULL,
  product_license_url TEXT,
  product_attribution_html TEXT NOT NULL DEFAULT '',
  product_source_url TEXT,
  product_source_provider TEXT,
  fulfillment_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  line_total_cents INTEGER NOT NULL DEFAULT 0,
  product_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookstore_order_items_qty_check') THEN
    ALTER TABLE bookstore_order_items
      ADD CONSTRAINT bookstore_order_items_qty_check
      CHECK (quantity > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bookstore_order_items_order_idx ON bookstore_order_items(order_id);
CREATE INDEX IF NOT EXISTS bookstore_order_items_product_idx ON bookstore_order_items(product_id);

CREATE TABLE IF NOT EXISTS bookstore_download_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES bookstore_orders(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES bookstore_products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL DEFAULT 'download',
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bookstore_download_events_product_idx ON bookstore_download_events(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookstore_download_events_order_idx ON bookstore_download_events(order_id, created_at DESC);

INSERT INTO bookstore_shipping_profiles (name, rules_json)
VALUES
  ('Default POD', '{"base_cents": 5500, "per_item_cents": 2500, "currency": "ZAR"}'::jsonb),
  ('Supplier Courier', '{"base_cents": 8500, "per_item_cents": 3500, "currency": "ZAR"}'::jsonb)
ON CONFLICT (name) DO NOTHING;
