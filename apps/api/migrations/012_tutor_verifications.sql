CREATE TABLE IF NOT EXISTS tutor_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL CHECK (
    badge_type IN (
      'verified_graduate',
      'verified_student',
      'verified_teacher'
    )
  ),
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'approved', 'rejected', 'revoked')
  ),
  document_url TEXT NOT NULL,
  document_name TEXT,
  submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tutor_id, badge_type)
);

CREATE INDEX IF NOT EXISTS tutor_verifications_status_idx ON tutor_verifications (status);
CREATE INDEX IF NOT EXISTS tutor_verifications_tutor_idx ON tutor_verifications (tutor_id);
CREATE INDEX IF NOT EXISTS tutor_verifications_badge_idx ON tutor_verifications (badge_type);
