CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION planner_current_user_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  raw_value TEXT;
BEGIN
  raw_value := NULLIF(current_setting('app.current_user_id', true), '');
  IF raw_value IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN raw_value::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

CREATE TABLE IF NOT EXISTS universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL DEFAULT 'ZA',
  student_system TEXT NOT NULL CHECK (student_system IN ('campusnexus', 'peoplesoft', 'moodle', 'its', 'other')),
  calendar_url TEXT,
  exam_timetable_url TEXT,
  class_timetable_url TEXT,
  yearbook_url TEXT,
  portal_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS university_campuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  campus_name TEXT NOT NULL,
  campus_code TEXT NOT NULL,
  city TEXT,
  province TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (university_id, campus_code)
);

CREATE TABLE IF NOT EXISTS academic_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  campus_id UUID REFERENCES university_campuses(id) ON DELETE SET NULL,
  year INTEGER NOT NULL,
  label TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'semester_start', 'semester_end',
    'exam_opp1_start', 'exam_opp1_end',
    'exam_opp2_start', 'exam_opp2_end',
    'exam_opp3_start', 'exam_opp3_end',
    'recess_start', 'recess_end',
    'orientation', 'registration',
    'graduation', 'public_holiday',
    'special_holiday', 'campus_event', 'other'
  )),
  semester INTEGER CHECK (semester IN (1, 2)),
  start_date DATE NOT NULL,
  end_date DATE,
  is_no_events_period BOOLEAN NOT NULL DEFAULT FALSE,
  source_url TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf_parsed', 'html_scraped', 'ical', 'manual', 'api')),
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS campus_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  campus_id UUID REFERENCES university_campuses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  location TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'graduation', 'sports', 'registration', 'orientation',
    'career', 'cultural', 'academic', 'admin', 'other'
  )),
  source_url TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf_parsed', 'html_scraped', 'ical', 'manual', 'api')),
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date IS NULL OR end_date >= event_date),
  CHECK (
    start_time IS NULL
    OR end_time IS NULL
    OR end_time > start_time
  )
);

CREATE TABLE IF NOT EXISTS module_timetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  campus_id UUID REFERENCES university_campuses(id) ON DELETE SET NULL,
  module_code TEXT NOT NULL,
  module_name TEXT,
  semester INTEGER NOT NULL CHECK (semester IN (1, 2)),
  year INTEGER NOT NULL,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  venue TEXT,
  group_code TEXT,
  lecturer TEXT,
  source_url TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf_parsed', 'html_scraped', 'ical', 'manual', 'api')),
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS exam_timetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  campus_id UUID REFERENCES university_campuses(id) ON DELETE SET NULL,
  module_code TEXT NOT NULL,
  module_name TEXT,
  opportunity INTEGER NOT NULL CHECK (opportunity IN (1, 2, 3)),
  year INTEGER NOT NULL,
  exam_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  venue TEXT,
  paper_number INTEGER,
  source_url TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf_parsed', 'html_scraped', 'ical', 'manual', 'api')),
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    start_time IS NULL
    OR end_time IS NULL
    OR end_time > start_time
  )
);

CREATE TABLE IF NOT EXISTS enrolled_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  campus_id UUID REFERENCES university_campuses(id) ON DELETE SET NULL,
  module_code TEXT NOT NULL,
  module_name TEXT,
  year INTEGER NOT NULL,
  semester INTEGER CHECK (semester IN (1, 2)),
  credits INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, module_code, year, semester)
);

CREATE TABLE IF NOT EXISTS student_planner_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'semester_boundary', 'exam', 'class',
    'assignment_due', 'campus_event',
    'public_holiday', 'recess', 'personal'
  )),
  tier TEXT NOT NULL CHECK (tier IN ('tier1', 'tier2', 'tier3', 'manual')),
  source_ref_id UUID,
  source_table TEXT,
  university_id UUID REFERENCES universities(id) ON DELETE SET NULL,
  module_code TEXT,
  is_manual BOOLEAN NOT NULL DEFAULT FALSE,
  is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  colour_tag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date IS NULL OR end_date >= event_date),
  CHECK (
    start_time IS NULL
    OR end_time IS NULL
    OR end_time > start_time
  )
);

CREATE TABLE IF NOT EXISTS student_university_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE RESTRICT,
  campus_id UUID REFERENCES university_campuses(id) ON DELETE SET NULL,
  faculty TEXT,
  year_of_study INTEGER CHECK (year_of_study BETWEEN 1 AND 8),
  qualification TEXT,
  student_number TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  tier2_activated BOOLEAN NOT NULL DEFAULT FALSE,
  tier3_activated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendar_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result TEXT NOT NULL CHECK (result IN ('success', 'partial', 'error')),
  rows_inserted INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN student_university_profiles.student_number IS
  'Display-only identifier; never used for portal scraping or authentication.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_calendars_identity
  ON academic_calendars (
    COALESCE(university_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(campus_id, '00000000-0000-0000-0000-000000000000'::uuid),
    year,
    event_type,
    start_date,
    COALESCE(end_date, start_date),
    label
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_campus_events_identity
  ON campus_events (
    university_id,
    COALESCE(campus_id, '00000000-0000-0000-0000-000000000000'::uuid),
    event_date,
    COALESCE(end_date, event_date),
    title
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_module_timetables_identity
  ON module_timetables (
    university_id,
    COALESCE(campus_id, '00000000-0000-0000-0000-000000000000'::uuid),
    module_code,
    semester,
    year,
    day_of_week,
    start_time,
    end_time,
    COALESCE(group_code, '')
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_timetables_identity
  ON exam_timetables (
    university_id,
    COALESCE(campus_id, '00000000-0000-0000-0000-000000000000'::uuid),
    module_code,
    opportunity,
    year,
    exam_date,
    COALESCE(paper_number, 0)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_planner_events_source
  ON student_planner_events (
    student_id,
    source_table,
    source_ref_id,
    event_date,
    COALESCE(start_time, '00:00'::time)
  )
  WHERE source_ref_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_academic_calendars_university_year
  ON academic_calendars (university_id, year);
CREATE INDEX IF NOT EXISTS idx_exam_timetables_module_year
  ON exam_timetables (university_id, module_code, year, opportunity);
CREATE INDEX IF NOT EXISTS idx_module_timetables_module
  ON module_timetables (university_id, module_code, year, semester);
CREATE INDEX IF NOT EXISTS idx_enrolled_modules_student
  ON enrolled_modules (student_id, year);
CREATE INDEX IF NOT EXISTS idx_student_planner_events_student_date
  ON student_planner_events (student_id, event_date);
CREATE INDEX IF NOT EXISTS idx_student_planner_events_student_type
  ON student_planner_events (student_id, event_type);
CREATE INDEX IF NOT EXISTS idx_campus_events_university_date
  ON campus_events (university_id, event_date);
CREATE INDEX IF NOT EXISTS idx_student_university_profiles_university
  ON student_university_profiles (university_id, campus_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_log_university_run
  ON calendar_sync_log (university_id, run_at DESC);

ALTER TABLE universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE university_campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrolled_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_planner_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_university_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS universities_public_select ON universities;
CREATE POLICY universities_public_select
  ON universities
  FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS university_campuses_public_select ON university_campuses;
CREATE POLICY university_campuses_public_select
  ON university_campuses
  FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS academic_calendars_public_select ON academic_calendars;
CREATE POLICY academic_calendars_public_select
  ON academic_calendars
  FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS campus_events_public_select ON campus_events;
CREATE POLICY campus_events_public_select
  ON campus_events
  FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS module_timetables_public_select ON module_timetables;
CREATE POLICY module_timetables_public_select
  ON module_timetables
  FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS exam_timetables_public_select ON exam_timetables;
CREATE POLICY exam_timetables_public_select
  ON exam_timetables
  FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS calendar_sync_log_public_select ON calendar_sync_log;
CREATE POLICY calendar_sync_log_public_select
  ON calendar_sync_log
  FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS enrolled_modules_owner_select ON enrolled_modules;
CREATE POLICY enrolled_modules_owner_select
  ON enrolled_modules
  FOR SELECT
  USING (student_id = planner_current_user_id());

DROP POLICY IF EXISTS enrolled_modules_owner_insert ON enrolled_modules;
CREATE POLICY enrolled_modules_owner_insert
  ON enrolled_modules
  FOR INSERT
  WITH CHECK (student_id = planner_current_user_id());

DROP POLICY IF EXISTS enrolled_modules_owner_update ON enrolled_modules;
CREATE POLICY enrolled_modules_owner_update
  ON enrolled_modules
  FOR UPDATE
  USING (student_id = planner_current_user_id())
  WITH CHECK (student_id = planner_current_user_id());

DROP POLICY IF EXISTS enrolled_modules_owner_delete ON enrolled_modules;
CREATE POLICY enrolled_modules_owner_delete
  ON enrolled_modules
  FOR DELETE
  USING (student_id = planner_current_user_id());

DROP POLICY IF EXISTS student_planner_events_owner_select ON student_planner_events;
CREATE POLICY student_planner_events_owner_select
  ON student_planner_events
  FOR SELECT
  USING (student_id = planner_current_user_id());

DROP POLICY IF EXISTS student_planner_events_owner_insert ON student_planner_events;
CREATE POLICY student_planner_events_owner_insert
  ON student_planner_events
  FOR INSERT
  WITH CHECK (student_id = planner_current_user_id());

DROP POLICY IF EXISTS student_planner_events_owner_update ON student_planner_events;
CREATE POLICY student_planner_events_owner_update
  ON student_planner_events
  FOR UPDATE
  USING (student_id = planner_current_user_id())
  WITH CHECK (student_id = planner_current_user_id());

DROP POLICY IF EXISTS student_planner_events_owner_delete ON student_planner_events;
CREATE POLICY student_planner_events_owner_delete
  ON student_planner_events
  FOR DELETE
  USING (student_id = planner_current_user_id());

DROP POLICY IF EXISTS student_university_profiles_owner_select ON student_university_profiles;
CREATE POLICY student_university_profiles_owner_select
  ON student_university_profiles
  FOR SELECT
  USING (student_id = planner_current_user_id());

DROP POLICY IF EXISTS student_university_profiles_owner_insert ON student_university_profiles;
CREATE POLICY student_university_profiles_owner_insert
  ON student_university_profiles
  FOR INSERT
  WITH CHECK (student_id = planner_current_user_id());

DROP POLICY IF EXISTS student_university_profiles_owner_update ON student_university_profiles;
CREATE POLICY student_university_profiles_owner_update
  ON student_university_profiles
  FOR UPDATE
  USING (student_id = planner_current_user_id())
  WITH CHECK (student_id = planner_current_user_id());

DROP POLICY IF EXISTS student_university_profiles_owner_delete ON student_university_profiles;
CREATE POLICY student_university_profiles_owner_delete
  ON student_university_profiles
  FOR DELETE
  USING (student_id = planner_current_user_id());

CREATE OR REPLACE FUNCTION populate_tier1_planner(p_student_id UUID, p_university_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_count INTEGER := 0;
  affected_rows INTEGER := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT *
    FROM academic_calendars
    WHERE (
      (p_university_id IS NOT NULL AND university_id = p_university_id)
      OR university_id IS NULL
    )
      AND (
        EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
        OR EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE) + 1
      )
      AND event_type <> 'other'
  LOOP
    INSERT INTO student_planner_events (
      student_id,
      title,
      event_date,
      end_date,
      event_type,
      tier,
      source_ref_id,
      source_table,
      university_id,
      is_manual
    )
    VALUES (
      p_student_id,
      rec.label,
      rec.start_date,
      rec.end_date,
      CASE rec.event_type
        WHEN 'semester_start' THEN 'semester_boundary'
        WHEN 'semester_end' THEN 'semester_boundary'
        WHEN 'exam_opp1_start' THEN 'exam'
        WHEN 'exam_opp1_end' THEN 'exam'
        WHEN 'exam_opp2_start' THEN 'exam'
        WHEN 'exam_opp2_end' THEN 'exam'
        WHEN 'exam_opp3_start' THEN 'exam'
        WHEN 'exam_opp3_end' THEN 'exam'
        WHEN 'public_holiday' THEN 'public_holiday'
        WHEN 'special_holiday' THEN 'public_holiday'
        WHEN 'recess_start' THEN 'recess'
        WHEN 'recess_end' THEN 'recess'
        ELSE 'campus_event'
      END,
      'tier1',
      rec.id,
      'academic_calendars',
      rec.university_id,
      FALSE
    )
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    inserted_count := inserted_count + affected_rows;
  END LOOP;

  FOR rec IN
    SELECT *
    FROM campus_events
    WHERE (
      (p_university_id IS NOT NULL AND university_id = p_university_id)
      OR university_id IS NULL
    )
      AND (
        EXTRACT(YEAR FROM event_date) = EXTRACT(YEAR FROM CURRENT_DATE)
        OR EXTRACT(YEAR FROM event_date) = EXTRACT(YEAR FROM CURRENT_DATE) + 1
      )
  LOOP
    INSERT INTO student_planner_events (
      student_id,
      title,
      description,
      event_date,
      end_date,
      start_time,
      end_time,
      event_type,
      tier,
      source_ref_id,
      source_table,
      university_id,
      is_manual
    )
    VALUES (
      p_student_id,
      rec.title,
      rec.description,
      rec.event_date,
      rec.end_date,
      rec.start_time,
      rec.end_time,
      'campus_event',
      'tier1',
      rec.id,
      'campus_events',
      rec.university_id,
      FALSE
    )
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    inserted_count := inserted_count + affected_rows;
  END LOOP;

  RETURN inserted_count;
END;
$$;

DROP TRIGGER IF EXISTS trg_universities_set_updated_at ON universities;
CREATE TRIGGER trg_universities_set_updated_at
  BEFORE UPDATE ON universities
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_university_campuses_set_updated_at ON university_campuses;
CREATE TRIGGER trg_university_campuses_set_updated_at
  BEFORE UPDATE ON university_campuses
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_academic_calendars_set_updated_at ON academic_calendars;
CREATE TRIGGER trg_academic_calendars_set_updated_at
  BEFORE UPDATE ON academic_calendars
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_campus_events_set_updated_at ON campus_events;
CREATE TRIGGER trg_campus_events_set_updated_at
  BEFORE UPDATE ON campus_events
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_module_timetables_set_updated_at ON module_timetables;
CREATE TRIGGER trg_module_timetables_set_updated_at
  BEFORE UPDATE ON module_timetables
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_exam_timetables_set_updated_at ON exam_timetables;
CREATE TRIGGER trg_exam_timetables_set_updated_at
  BEFORE UPDATE ON exam_timetables
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_enrolled_modules_set_updated_at ON enrolled_modules;
CREATE TRIGGER trg_enrolled_modules_set_updated_at
  BEFORE UPDATE ON enrolled_modules
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_student_planner_events_set_updated_at ON student_planner_events;
CREATE TRIGGER trg_student_planner_events_set_updated_at
  BEFORE UPDATE ON student_planner_events
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_student_university_profiles_set_updated_at ON student_university_profiles;
CREATE TRIGGER trg_student_university_profiles_set_updated_at
  BEFORE UPDATE ON student_university_profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_calendar_sync_log_set_updated_at ON calendar_sync_log;
CREATE TRIGGER trg_calendar_sync_log_set_updated_at
  BEFORE UPDATE ON calendar_sync_log
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();
