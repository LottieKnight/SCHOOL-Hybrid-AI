CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  region TEXT,
  avatar_uniform JSONB NOT NULL DEFAULT '{}'::jsonb,
  avatar_casual JSONB NOT NULL DEFAULT '{}'::jsonb,
  likes TEXT[] NOT NULL DEFAULT '{}',
  interests TEXT[] NOT NULL DEFAULT '{}',
  favorite_book TEXT,
  favorite_movie TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_profiles_username_idx ON user_profiles (username);

CREATE TABLE IF NOT EXISTS friends (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  achieved_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'achievements_category_check'
  ) THEN
    ALTER TABLE achievements
      ADD CONSTRAINT achievements_category_check
      CHECK (category IN ('academic', 'extracurricular'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS achievements_user_idx ON achievements(user_id);
