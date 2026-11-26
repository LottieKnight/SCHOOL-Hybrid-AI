CREATE TABLE IF NOT EXISTS university_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT,
  file_key TEXT,
  extracted_text TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS university_plans_user_uploaded_idx
  ON university_plans (user_id, uploaded_at DESC);
