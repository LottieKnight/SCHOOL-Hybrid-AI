ALTER TABLE tutor_sessions
  ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT,
  ADD COLUMN IF NOT EXISTS dispute_opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_outcome TEXT,
  ADD COLUMN IF NOT EXISTS payout_eligible_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS platform_fee_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS tutor_payout_amount NUMERIC(10, 2);

UPDATE tutor_sessions
SET
  scheduled_start_at = COALESCE(scheduled_start_at, start_time),
  scheduled_end_at = COALESCE(scheduled_end_at, end_time)
WHERE scheduled_start_at IS NULL OR scheduled_end_at IS NULL;

UPDATE tutor_sessions
SET status = 'cancelled_by_learner'
WHERE status = 'cancelled';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tutor_sessions_status_check'
  ) THEN
    ALTER TABLE tutor_sessions DROP CONSTRAINT tutor_sessions_status_check;
  END IF;
END $$;

ALTER TABLE tutor_sessions
  ADD CONSTRAINT tutor_sessions_status_check
  CHECK (
    status IN (
      'requested',
      'confirmed',
      'completed',
      'cancelled_by_learner',
      'cancelled_by_tutor',
      'no_show_learner',
      'no_show_tutor',
      'disputed',
      'resolved'
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tutor_sessions_resolution_check'
  ) THEN
    ALTER TABLE tutor_sessions
      ADD CONSTRAINT tutor_sessions_resolution_check
      CHECK (
        resolution_outcome IS NULL OR resolution_outcome IN (
          'uphold_tutor',
          'partial_refund',
          'full_refund',
          'tutor_fault',
          'learner_fault'
        )
      );
  END IF;
END $$;
