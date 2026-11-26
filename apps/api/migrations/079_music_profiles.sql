-- Music Social Discovery: per-user music identity (genres, artists, playlist, vibes, visibility)
CREATE TABLE IF NOT EXISTS student_music_profiles (
  user_id     UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  genres      TEXT[]      NOT NULL DEFAULT '{}',
  artists     TEXT[]      NOT NULL DEFAULT '{}',
  playlist_url    TEXT,
  playlist_title  TEXT,
  vibe_tags   TEXT[]      NOT NULL DEFAULT '{}',
  visibility  TEXT        NOT NULL DEFAULT 'campus'
              CHECK (visibility IN ('public', 'campus', 'private')),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_smp_genres
  ON student_music_profiles USING GIN (genres);

CREATE INDEX IF NOT EXISTS idx_smp_visibility
  ON student_music_profiles (visibility);
