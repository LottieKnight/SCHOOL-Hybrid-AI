DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'curriculum_node_type') THEN
    CREATE TYPE curriculum_node_type AS ENUM ('LEARN', 'PHASE', 'GRADE', 'SUBJECT', 'TERM', 'WEEK', 'LESSON');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lesson_status') THEN
    CREATE TYPE lesson_status AS ENUM ('DRAFT', 'PUBLISHED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'generation_status') THEN
    CREATE TYPE generation_status AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS curriculum_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES curriculum_nodes(id) ON DELETE CASCADE,
  type curriculum_node_type NOT NULL,
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS curriculum_nodes_parent_type_key_idx
  ON curriculum_nodes(parent_id, type, key);
CREATE INDEX IF NOT EXISTS curriculum_nodes_type_idx ON curriculum_nodes(type);
CREATE INDEX IF NOT EXISTS curriculum_nodes_parent_idx ON curriculum_nodes(parent_id);

CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES curriculum_nodes(id) ON DELETE SET NULL,
  phase TEXT NOT NULL,
  grade INTEGER NOT NULL,
  subject_key TEXT NOT NULL,
  term INTEGER NOT NULL,
  week INTEGER NOT NULL,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  status lesson_status NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS lessons_unique_version_idx
  ON lessons(phase, grade, subject_key, term, week, version);
CREATE INDEX IF NOT EXISTS lessons_lookup_idx
  ON lessons(phase, grade, subject_key, term, week, status);
CREATE INDEX IF NOT EXISTS lessons_node_idx ON lessons(node_id);

CREATE TABLE IF NOT EXISTS generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES curriculum_nodes(id) ON DELETE SET NULL,
  request JSONB NOT NULL DEFAULT '{}'::jsonb,
  status generation_status NOT NULL DEFAULT 'QUEUED',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS generation_jobs_status_idx ON generation_jobs(status);
CREATE INDEX IF NOT EXISTS generation_jobs_node_idx ON generation_jobs(node_id);
