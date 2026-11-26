CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  module_code TEXT,
  content TEXT NOT NULL,
  post_type TEXT NOT NULL DEFAULT 'general',
  audience TEXT NOT NULL DEFAULT 'campus',
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  attachment_url TEXT,
  accepted_answer_id UUID,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (post_type IN ('general', 'question', 'resource', 'announcement')),
  CHECK (audience IN ('campus', 'faculty', 'module', 'public'))
);

CREATE INDEX IF NOT EXISTS posts_institution_created_idx
  ON posts (institution_id, created_at DESC);

CREATE INDEX IF NOT EXISTS posts_module_created_idx
  ON posts (module_code, created_at DESC);

CREATE TABLE IF NOT EXISTS post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id, reaction_type),
  CHECK (
    reaction_type IN (
      'got_it',
      'same_question',
      'great_explanation',
      'saving_this',
      'exam_relevant'
    )
  )
);

CREATE INDEX IF NOT EXISTS post_reactions_post_idx
  ON post_reactions (post_id, created_at DESC);

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comments_post_created_idx
  ON comments (post_id, created_at ASC);

CREATE TABLE IF NOT EXISTS module_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  module_code TEXT NOT NULL,
  module_name TEXT NOT NULL,
  pinned_post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (institution_id, module_code)
);

CREATE INDEX IF NOT EXISTS module_rooms_code_idx
  ON module_rooms (module_code);

CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE TABLE IF NOT EXISTS community_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL,
  content_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (content_type IN ('post', 'comment', 'profile')),
  CHECK (reason IN ('spam', 'inappropriate', 'misinformation', 'harassment', 'off_topic')),
  CHECK (status IN ('pending', 'reviewed', 'actioned'))
);

CREATE INDEX IF NOT EXISTS community_reports_status_idx
  ON community_reports (status, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'posts_accepted_answer_fk'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_accepted_answer_fk
      FOREIGN KEY (accepted_answer_id)
      REFERENCES comments(id)
      ON DELETE SET NULL;
  END IF;
END $$;
