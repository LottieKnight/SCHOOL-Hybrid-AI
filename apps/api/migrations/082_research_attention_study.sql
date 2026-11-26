-- AURA Laboratory research telemetry — attention / inattentional-blindness studies.
--
-- Supports the "observational silence" study (Simons & Chabris, 1999 paradigm)
-- and any future SCHOOL study via a study registry, so the schema is the
-- foundation of the research flywheel rather than a one-off table.
--
-- POPIA design notes:
--   * Research consent is study-scoped, versioned and independently revocable
--     (separate from the platform account consent already on `users`).
--   * Telemetry is keyed to a pseudonymous participant_ref. user_id is
--     ON DELETE SET NULL and is cleared by the existing anonymisation cron
--     (migration 077), so the scientific dataset survives account deletion
--     without retaining identity.
--   * Minor participants reuse users.is_minor / users.parent_email /
--     users.parental_consent_given_at (migrations 073 / 078) and require recorded
--     guardian consent before any session may start.
--   * No raw IP or full user-agent is stored — only a salted hash and a coarse
--     browser family.

-- 1. Study registry ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS research_studies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,                  -- slug, e.g. 'observational-silence-v1'
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'recruiting', 'paused', 'closed')),
    ethics_ref TEXT,                            -- NWU Research Ethics Committee clearance no.
    principal_investigator TEXT,                -- e.g. 'Mondli Manzi (NWU Psychology)'
    current_consent_version TEXT NOT NULL DEFAULT 'v1',
    current_stimulus_version TEXT NOT NULL DEFAULT 'v1',
    min_age INTEGER NOT NULL DEFAULT 18,        -- enrolment gate; set < 18 only with a minor protocol
    config JSONB NOT NULL DEFAULT '{}'::jsonb,  -- conditions, primary-task copy, probe schedule
    opened_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_studies_status ON research_studies(status);

-- 2. Consent (study-scoped, versioned, revocable) ---------------------------
CREATE TABLE IF NOT EXISTS research_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id UUID NOT NULL REFERENCES research_studies(id) ON DELETE CASCADE,
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    participant_ref TEXT NOT NULL,              -- pseudonym, stable within a study
    consent_version TEXT NOT NULL,
    consent_scope JSONB NOT NULL DEFAULT '{}'::jsonb,   -- exactly what the participant agreed to
    is_minor BOOLEAN NOT NULL DEFAULT FALSE,            -- snapshot at consent time
    guardian_consent_required BOOLEAN NOT NULL DEFAULT FALSE,
    guardian_consent_given_at TIMESTAMPTZ,
    guardian_email TEXT,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    withdrawn_at TIMESTAMPTZ,
    withdrawal_reason TEXT,
    consent_ip_hash TEXT,                       -- salted hash, never the raw IP
    user_agent_family TEXT,                     -- coarse browser family only
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most one active (non-withdrawn) consent per participant per study.
CREATE UNIQUE INDEX IF NOT EXISTS uq_research_consents_active
    ON research_consents(study_id, participant_ref)
    WHERE withdrawn_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_research_consents_study ON research_consents(study_id);
CREATE INDEX IF NOT EXISTS idx_research_consents_user ON research_consents(user_id);

-- 3. Sessions (one play-through of the game) --------------------------------
CREATE TABLE IF NOT EXISTS research_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id UUID NOT NULL REFERENCES research_studies(id) ON DELETE CASCADE,
    consent_id UUID NOT NULL REFERENCES research_consents(id) ON DELETE CASCADE,
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    participant_ref TEXT NOT NULL,
    condition TEXT,                             -- experimental arm
    stimulus_version TEXT NOT NULL,
    is_practice BOOLEAN NOT NULL DEFAULT FALSE,
    primary_task TEXT,                          -- e.g. 'count white-team passes'
    reported_pass_count INTEGER,
    actual_pass_count INTEGER,
    -- Selective-attention accuracy, computed once and stored.
    pass_count_error INTEGER GENERATED ALWAYS AS (
        CASE
            WHEN reported_pass_count IS NULL OR actual_pass_count IS NULL THEN NULL
            ELSE ABS(reported_pass_count - actual_pass_count)
        END
    ) STORED,
    device JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'completed', 'abandoned', 'withdrawn')),
    quality_flags JSONB NOT NULL DEFAULT '{}'::jsonb,   -- focus_lost_count, clock_drift_ms, etc.
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_sessions_study ON research_sessions(study_id);
CREATE INDEX IF NOT EXISTS idx_research_sessions_consent ON research_sessions(consent_id);
CREATE INDEX IF NOT EXISTS idx_research_sessions_status ON research_sessions(status);
CREATE INDEX IF NOT EXISTS idx_research_sessions_started ON research_sessions(started_at DESC);

-- 4. Trial event stream (the experiment clock) ------------------------------
CREATE TABLE IF NOT EXISTS research_trial_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES research_sessions(id) ON DELETE CASCADE,
    study_id UUID NOT NULL REFERENCES research_studies(id) ON DELETE CASCADE,  -- denormalised for export queries
    seq INTEGER NOT NULL,                       -- monotonic order within the session
    event_type TEXT NOT NULL,                   -- see RESEARCH_TRIAL_EVENT_TYPES in @saedu/shared
    event_time_ms BIGINT NOT NULL,              -- ms from stimulus_onset (monotonic clock)
    client_ts TIMESTAMPTZ,                      -- wall clock, best-effort
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (session_id, seq) is unique so client retries are idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS uq_research_trial_events_seq
    ON research_trial_events(session_id, seq);
CREATE INDEX IF NOT EXISTS idx_research_trial_events_session
    ON research_trial_events(session_id, event_time_ms);
CREATE INDEX IF NOT EXISTS idx_research_trial_events_type
    ON research_trial_events(study_id, event_type);

-- 5. Noticing outcomes (the inattentional-blindness measure) -----------------
CREATE TABLE IF NOT EXISTS research_noticing_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES research_sessions(id) ON DELETE CASCADE,
    study_id UUID NOT NULL REFERENCES research_studies(id) ON DELETE CASCADE,
    critical_event_key TEXT NOT NULL,           -- 'gorilla', 'curtain_color_change', ...
    noticed BOOLEAN NOT NULL,
    notice_latency_ms INTEGER,                  -- notice_flagged − anomaly_onset
    confidence SMALLINT CHECK (confidence IS NULL OR (confidence BETWEEN 1 AND 5)),
    free_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_research_noticing_outcome
    ON research_noticing_outcomes(session_id, critical_event_key);
CREATE INDEX IF NOT EXISTS idx_research_noticing_study
    ON research_noticing_outcomes(study_id, critical_event_key);

-- 6. Recall / memory probes (post-trial) ------------------------------------
CREATE TABLE IF NOT EXISTS research_recall_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES research_sessions(id) ON DELETE CASCADE,
    study_id UUID NOT NULL REFERENCES research_studies(id) ON DELETE CASCADE,
    prompt_key TEXT NOT NULL,
    response_value JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_correct BOOLEAN,
    score NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_research_recall_response
    ON research_recall_responses(session_id, prompt_key);
CREATE INDEX IF NOT EXISTS idx_research_recall_study
    ON research_recall_responses(study_id, prompt_key);
