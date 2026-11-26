CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  province TEXT,
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS schools_name_idx ON schools (LOWER(name));
CREATE INDEX IF NOT EXISTS schools_country_idx ON schools (country);
CREATE INDEX IF NOT EXISTS schools_city_idx ON schools (city);

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS province TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

CREATE INDEX IF NOT EXISTS user_profiles_school_idx ON user_profiles (school_id);
