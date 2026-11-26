-- apps/api/migrations/080_bursary_tracker.sql

CREATE TABLE IF NOT EXISTS bursaries (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text         NOT NULL,
  provider        text         NOT NULL,
  provider_type   text         NOT NULL
                  CHECK (provider_type IN ('nsfas','seta','corporate','ngo','government','other')),
  seta_name       text,
  fields_of_study text[]       NOT NULL DEFAULT '{}',
  year_levels     text[]       NOT NULL DEFAULT '{}',
  needs_based     boolean      NOT NULL DEFAULT false,
  merit_based     boolean      NOT NULL DEFAULT false,
  amount_min      integer,
  amount_max      integer,
  deadline        date,
  description     text,
  requirements    text[]       NOT NULL DEFAULT '{}',
  link            text         NOT NULL,
  is_active       boolean      NOT NULL DEFAULT true,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bursaries_active
  ON bursaries (is_active);

CREATE INDEX IF NOT EXISTS idx_bursaries_deadline
  ON bursaries (deadline) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_bursaries_fields
  ON bursaries USING GIN (fields_of_study);

CREATE INDEX IF NOT EXISTS idx_bursaries_years
  ON bursaries USING GIN (year_levels);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bursaries_title_seed
  ON bursaries (title);

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS field_of_study     text,
  ADD COLUMN IF NOT EXISTS year_of_study      text
    CHECK (year_of_study IN ('school','1','2','3','4','postgrad')),
  ADD COLUMN IF NOT EXISTS needs_financial_aid boolean NOT NULL DEFAULT false;
