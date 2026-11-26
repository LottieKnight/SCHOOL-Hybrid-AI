-- Language layer event logging (v1)
-- Purpose: capture real user interactions before full glossary/correction tables move into Postgres.

CREATE TABLE IF NOT EXISTS language_search_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    session_id TEXT,
    source_surface TEXT NOT NULL,
    raw_query TEXT NOT NULL,
    normalized_query TEXT,
    intent TEXT,
    module_code TEXT,
    expansions JSONB NOT NULL DEFAULT '[]'::jsonb,
    results JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_language_search_events_user_id ON language_search_events(user_id);
CREATE INDEX IF NOT EXISTS idx_language_search_events_module_code ON language_search_events(module_code);
CREATE INDEX IF NOT EXISTS idx_language_search_events_created_at ON language_search_events(created_at DESC);

CREATE TABLE IF NOT EXISTS language_rewrite_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    session_id TEXT,
    source_surface TEXT NOT NULL,
    module_code TEXT,
    rewrite_mode TEXT NOT NULL,
    original_text TEXT NOT NULL,
    output_text TEXT NOT NULL,
    confidence_score DOUBLE PRECISION,
    accepted BOOLEAN,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_language_rewrite_events_user_id ON language_rewrite_events(user_id);
CREATE INDEX IF NOT EXISTS idx_language_rewrite_events_module_code ON language_rewrite_events(module_code);
CREATE INDEX IF NOT EXISTS idx_language_rewrite_events_mode ON language_rewrite_events(rewrite_mode);
CREATE INDEX IF NOT EXISTS idx_language_rewrite_events_created_at ON language_rewrite_events(created_at DESC);

CREATE TABLE IF NOT EXISTS language_feedback_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    session_id TEXT,
    event_type TEXT NOT NULL,
    source_surface TEXT NOT NULL,
    request_id TEXT,
    output_id TEXT,
    accepted BOOLEAN,
    edited_after_accept BOOLEAN NOT NULL DEFAULT FALSE,
    rating INTEGER NULL CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
    note TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_language_feedback_events_user_id ON language_feedback_events(user_id);
CREATE INDEX IF NOT EXISTS idx_language_feedback_events_event_type ON language_feedback_events(event_type);
CREATE INDEX IF NOT EXISTS idx_language_feedback_events_created_at ON language_feedback_events(created_at DESC);
