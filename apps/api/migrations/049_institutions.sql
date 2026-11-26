-- Create institutions table
CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT,
  domain TEXT UNIQUE,
  type TEXT CHECK (type IN ('school','university')),
  province TEXT,
  country TEXT DEFAULT 'ZA',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed NWU Vanderbijlpark as institution #1
INSERT INTO institutions (
  id, name, short_name, domain, type, province
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'North-West University Vanderbijlpark',
  'NWU VTC',
  'nwu.ac.za',
  'university',
  'Gauteng'
) ON CONFLICT (id) DO NOTHING;

-- Add institution_id to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS institution_id UUID
  REFERENCES institutions(id);

-- Default existing users to NWU
UPDATE users
  SET institution_id = '00000000-0000-0000-0000-000000000001'
  WHERE institution_id IS NULL;

DO $$
BEGIN
  IF to_regclass('public.resources') IS NOT NULL THEN
    EXECUTE '
      ALTER TABLE resources
        ADD COLUMN IF NOT EXISTS institution_id UUID
        REFERENCES institutions(id)
    ';

    EXECUTE '
      UPDATE resources
      SET institution_id = ''00000000-0000-0000-0000-000000000001''
      WHERE institution_id IS NULL
    ';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.bookstore_products') IS NOT NULL THEN
    EXECUTE '
      ALTER TABLE bookstore_products
        ADD COLUMN IF NOT EXISTS institution_id UUID
        REFERENCES institutions(id)
    ';

    EXECUTE '
      UPDATE bookstore_products
      SET institution_id = ''00000000-0000-0000-0000-000000000001''
      WHERE institution_id IS NULL
    ';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.listings') IS NOT NULL THEN
    EXECUTE '
      ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS institution_id UUID
        REFERENCES institutions(id)
    ';

    EXECUTE '
      UPDATE listings
      SET institution_id = ''00000000-0000-0000-0000-000000000001''
      WHERE institution_id IS NULL
    ';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.equipment_products') IS NOT NULL THEN
    EXECUTE '
      ALTER TABLE equipment_products
        ADD COLUMN IF NOT EXISTS institution_id UUID
        REFERENCES institutions(id)
    ';

    EXECUTE '
      UPDATE equipment_products
      SET institution_id = ''00000000-0000-0000-0000-000000000001''
      WHERE institution_id IS NULL
    ';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.ai_sessions') IS NOT NULL THEN
    EXECUTE '
      ALTER TABLE ai_sessions
        ADD COLUMN IF NOT EXISTS institution_id UUID
        REFERENCES institutions(id)
    ';

    EXECUTE '
      UPDATE ai_sessions
      SET institution_id = ''00000000-0000-0000-0000-000000000001''
      WHERE institution_id IS NULL
    ';
  END IF;
END $$;

-- Index for fast institution filtering
CREATE INDEX IF NOT EXISTS idx_users_institution
  ON users(institution_id);

DO $$
BEGIN
  IF to_regclass('public.resources') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_resources_institution ON resources(institution_id)';
  END IF;

  IF to_regclass('public.bookstore_products') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bookstore_products_institution ON bookstore_products(institution_id)';
  END IF;

  IF to_regclass('public.listings') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_listings_institution ON listings(institution_id)';
  END IF;

  IF to_regclass('public.equipment_products') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_equipment_products_institution ON equipment_products(institution_id)';
  END IF;

  IF to_regclass('public.ai_sessions') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ai_sessions_institution ON ai_sessions(institution_id)';
  END IF;
END $$;
