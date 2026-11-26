ALTER TABLE tutors
ADD COLUMN IF NOT EXISTS location_lat NUMERIC(8, 5),
ADD COLUMN IF NOT EXISTS location_lng NUMERIC(8, 5);

CREATE TABLE IF NOT EXISTS tutor_ranking_snapshots (
  tutor_id UUID PRIMARY KEY REFERENCES tutors(id) ON DELETE CASCADE,
  ranking_score NUMERIC(6, 2) NOT NULL,
  reliability_score INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tutor_ranking_computed_idx ON tutor_ranking_snapshots (computed_at);
