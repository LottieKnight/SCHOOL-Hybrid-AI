CREATE TABLE IF NOT EXISTS library_resources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 300),
  description     TEXT CHECK (char_length(description) <= 10000),
  content_type    TEXT NOT NULL CHECK (content_type IN (
                    'article','book','journal','publication','past_paper','video_lesson'
                  )),
  subject         TEXT,
  grade_band      TEXT CHECK (grade_band IN (
                    'foundation','intermediate','senior','fet','university','all'
                  )),
  topic_tags      TEXT[] DEFAULT '{}',
  author          TEXT,
  publisher       TEXT,
  published_year  INT CHECK (published_year BETWEEN 1800 AND 2100),
  language        TEXT NOT NULL DEFAULT 'en',
  access_type     TEXT NOT NULL DEFAULT 'free' CHECK (access_type IN (
                    'free','premium','subscription'
                  )),
  thumbnail_url   TEXT,
  resource_url    TEXT,
  storage_key     TEXT CHECK (char_length(storage_key) <= 500),
  file_type       TEXT CHECK (file_type IN ('pdf','epub','link','video','html')),
  file_size_bytes BIGINT,
  metadata_json   JSONB NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_library_resources_content_type
  ON library_resources(content_type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_library_resources_grade_band
  ON library_resources(grade_band) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_library_resources_subject
  ON library_resources(subject) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_library_resources_created_at
  ON library_resources(created_at DESC);

CREATE TABLE IF NOT EXISTS library_collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES library_resources(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_library_collections_user_id
  ON library_collections(user_id);
