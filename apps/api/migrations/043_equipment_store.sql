CREATE TABLE IF NOT EXISTS equipment_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES equipment_categories(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS equipment_categories_parent_idx
  ON equipment_categories(parent_id, sort_order, name);

CREATE TABLE IF NOT EXISTS equipment_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  brand TEXT,
  sku TEXT,
  category_id UUID NOT NULL REFERENCES equipment_categories(id) ON DELETE RESTRICT,
  phase_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  grade_min INTEGER NOT NULL DEFAULT 0,
  grade_max INTEGER NOT NULL DEFAULT 12,
  subject_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  fulfillment_type TEXT NOT NULL,
  stock_qty INTEGER,
  lead_time_days INTEGER,
  attributes_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_bundle BOOLEAN NOT NULL DEFAULT FALSE,
  bundle_items_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_products_grade_range_check') THEN
    ALTER TABLE equipment_products
      ADD CONSTRAINT equipment_products_grade_range_check
      CHECK (grade_min >= 0 AND grade_max <= 12 AND grade_min <= grade_max);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_products_price_cents_check') THEN
    ALTER TABLE equipment_products
      ADD CONSTRAINT equipment_products_price_cents_check
      CHECK (price_cents >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_products_lead_time_check') THEN
    ALTER TABLE equipment_products
      ADD CONSTRAINT equipment_products_lead_time_check
      CHECK (lead_time_days IS NULL OR lead_time_days >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_products_stock_qty_check') THEN
    ALTER TABLE equipment_products
      ADD CONSTRAINT equipment_products_stock_qty_check
      CHECK (stock_qty IS NULL OR stock_qty >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_products_fulfillment_type_check') THEN
    ALTER TABLE equipment_products
      ADD CONSTRAINT equipment_products_fulfillment_type_check
      CHECK (
        fulfillment_type IN (
          'STOCKED',
          'SHIP_FROM_SUPPLIER',
          'DROPSHIP',
          'AFFILIATE_LINK',
          'QUOTE_REQUIRED'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS equipment_products_category_idx
  ON equipment_products(category_id);
CREATE INDEX IF NOT EXISTS equipment_products_grade_idx
  ON equipment_products(grade_min, grade_max);
CREATE INDEX IF NOT EXISTS equipment_products_fulfillment_idx
  ON equipment_products(fulfillment_type);
CREATE INDEX IF NOT EXISTS equipment_products_phase_gin_idx
  ON equipment_products USING GIN(phase_tags);
CREATE INDEX IF NOT EXISTS equipment_products_subject_gin_idx
  ON equipment_products USING GIN(subject_tags);
CREATE INDEX IF NOT EXISTS equipment_products_tags_gin_idx
  ON equipment_products USING GIN(tags);
