CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS user_profiles_username_lower_idx
  ON user_profiles (LOWER(username));

CREATE INDEX IF NOT EXISTS user_profiles_username_trgm_idx
  ON user_profiles USING GIN (LOWER(username) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS user_profiles_location_idx
  ON user_profiles (country, province, city);

CREATE INDEX IF NOT EXISTS user_profiles_country_idx
  ON user_profiles (country);

CREATE INDEX IF NOT EXISTS user_profiles_province_idx
  ON user_profiles (province);

CREATE INDEX IF NOT EXISTS user_profiles_city_idx
  ON user_profiles (city);

CREATE INDEX IF NOT EXISTS friends_friend_id_idx
  ON friends (friend_id);

CREATE TABLE IF NOT EXISTS user_relationships (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, target_user_id, relationship_type)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_relationships_type_check'
  ) THEN
    ALTER TABLE user_relationships
      ADD CONSTRAINT user_relationships_type_check
      CHECK (relationship_type IN ('blocked', 'muted'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS user_relationships_lookup_idx
  ON user_relationships (user_id, relationship_type, target_user_id);

CREATE INDEX IF NOT EXISTS user_relationships_reverse_idx
  ON user_relationships (target_user_id, relationship_type, user_id);

CREATE TABLE IF NOT EXISTS product_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS product_events_name_created_idx
  ON product_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS product_events_user_created_idx
  ON product_events (user_id, created_at DESC);

DROP TABLE IF EXISTS friend_requests;
