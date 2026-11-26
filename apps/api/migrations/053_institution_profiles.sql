CREATE TABLE IF NOT EXISTS institution_profiles (
  institution_id UUID PRIMARY KEY REFERENCES institutions(id) ON DELETE CASCADE,
  academic_period_type TEXT NOT NULL DEFAULT 'semester'
    CHECK (academic_period_type IN ('semester', 'term', 'trimester', 'quarter')),
  faculties JSONB NOT NULL DEFAULT '[]'::jsonb,
  country TEXT NOT NULL DEFAULT 'ZA',
  region TEXT,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS resources
  ADD COLUMN IF NOT EXISTS institution_id UUID
  REFERENCES institutions(id);

ALTER TABLE bookstore_products
  ADD COLUMN IF NOT EXISTS institution_id UUID
  REFERENCES institutions(id);

CREATE INDEX IF NOT EXISTS idx_institution_profiles_period
  ON institution_profiles(academic_period_type);

CREATE INDEX IF NOT EXISTS idx_institution_profiles_country
  ON institution_profiles(country);

DO $$
BEGIN
  IF to_regclass('public.resources') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_resources_institution ON resources(institution_id)';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookstore_products_institution
  ON bookstore_products(institution_id);
