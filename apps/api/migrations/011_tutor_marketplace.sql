CREATE TABLE IF NOT EXISTS tutors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  highest_qualification TEXT NOT NULL,
  qualification_type TEXT NOT NULL CHECK (
    qualification_type IN (
      'grade_12',
      'university_student',
      'qualified_teacher',
      'retired_educator',
      'subject_specialist'
    )
  ),
  proof_of_qualification_url TEXT NOT NULL,
  proof_of_qualification_name TEXT,
  delivery_mode TEXT NOT NULL CHECK (delivery_mode IN ('online', 'in_person', 'hybrid')),
  location_country TEXT NOT NULL,
  location_province TEXT NOT NULL,
  location_city TEXT NOT NULL,
  location_address TEXT,
  radius_km NUMERIC(6, 2) NOT NULL CHECK (radius_km >= 0),
  hourly_rate NUMERIC(10, 2) NOT NULL CHECK (hourly_rate >= 120),
  bio TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  rating_avg NUMERIC(3, 2),
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tutors_user_id_idx ON tutors (user_id);
CREATE INDEX IF NOT EXISTS tutors_rating_idx ON tutors (rating_avg);
CREATE INDEX IF NOT EXISTS tutors_delivery_mode_idx ON tutors (delivery_mode);

CREATE TABLE IF NOT EXISTS tutor_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  qualification_type TEXT NOT NULL CHECK (
    qualification_type IN (
      'grade_12',
      'university_student',
      'qualified_teacher',
      'retired_educator',
      'subject_specialist'
    )
  ),
  title TEXT NOT NULL,
  institution TEXT,
  year_completed INTEGER,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tutor_qualifications_tutor_idx ON tutor_qualifications (tutor_id);

CREATE TABLE IF NOT EXISTS tutor_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,
  achieved_percent NUMERIC(5, 2),
  currently_studying BOOLEAN NOT NULL DEFAULT FALSE,
  professionally_qualified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (achieved_percent IS NOT NULL AND achieved_percent >= 60)
    OR currently_studying
    OR professionally_qualified
  )
);

CREATE INDEX IF NOT EXISTS tutor_subjects_tutor_idx ON tutor_subjects (tutor_id);
CREATE INDEX IF NOT EXISTS tutor_subjects_name_idx ON tutor_subjects (LOWER(subject_name));

CREATE TABLE IF NOT EXISTS tutor_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS tutor_availability_tutor_idx ON tutor_availability (tutor_id);

CREATE TABLE IF NOT EXISTS tutor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 120),
  status TEXT NOT NULL CHECK (
    status IN ('requested', 'confirmed', 'completed', 'cancelled', 'disputed')
  ),
  cancelled_by TEXT CHECK (cancelled_by IN ('tutor', 'learner', 'system')),
  cancelled_reason TEXT,
  disputed_reason TEXT,
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paid_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS tutor_sessions_tutor_idx ON tutor_sessions (tutor_id);
CREATE INDEX IF NOT EXISTS tutor_sessions_learner_idx ON tutor_sessions (learner_id);
CREATE INDEX IF NOT EXISTS tutor_sessions_status_idx ON tutor_sessions (status);

CREATE TABLE IF NOT EXISTS tutor_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES tutor_sessions(id) ON DELETE CASCADE,
  tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  flagged BOOLEAN NOT NULL DEFAULT FALSE,
  flagged_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tutor_ratings_tutor_idx ON tutor_ratings (tutor_id);
CREATE INDEX IF NOT EXISTS tutor_ratings_flagged_idx ON tutor_ratings (flagged);

CREATE TABLE IF NOT EXISTS commission_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES tutor_sessions(id) ON DELETE CASCADE,
  gross_amount NUMERIC(10, 2) NOT NULL,
  commission_rate NUMERIC(5, 2) NOT NULL,
  commission_amount NUMERIC(10, 2) NOT NULL,
  net_amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payout_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_gross NUMERIC(12, 2) NOT NULL,
  total_commission NUMERIC(12, 2) NOT NULL,
  total_net NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_batch_id UUID NOT NULL REFERENCES payout_batches(id) ON DELETE CASCADE,
  tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  session_id UUID NOT NULL UNIQUE REFERENCES tutor_sessions(id) ON DELETE CASCADE,
  gross_amount NUMERIC(10, 2) NOT NULL,
  commission_amount NUMERIC(10, 2) NOT NULL,
  net_amount NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending')),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payout_items_tutor_idx ON payout_items (tutor_id);
