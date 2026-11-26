ALTER TABLE generation_jobs
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

CREATE INDEX IF NOT EXISTS generation_jobs_started_at_idx ON generation_jobs(started_at DESC);
CREATE INDEX IF NOT EXISTS generation_jobs_completed_at_idx ON generation_jobs(completed_at DESC);
CREATE INDEX IF NOT EXISTS generation_jobs_failed_at_idx ON generation_jobs(failed_at DESC);
