-- Indexing for school search performance
CREATE INDEX IF NOT EXISTS idx_schools_name_lower ON schools (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_schools_location ON schools (country, province, city);

-- Indexing for user lookup and auth sessions
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'auth_sessions') THEN
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions (user_id);
  END IF;
END $$;

-- Indexing for profile lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_username_lower ON user_profiles (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_user_profiles_school_id ON user_profiles (school_id);
