-- BrandOS: Autonomous Personal Brand Management System

-- Raw signals from all sources (GitHub, trading journal, ideas.md, price feeds, manual)
CREATE TABLE brand_signals (
  id           SERIAL PRIMARY KEY,
  source       TEXT NOT NULL CHECK (source IN ('github','trading','ideas','price','manual','telegram')),
  raw_content  TEXT NOT NULL,
  pillar       TEXT NOT NULL CHECK (pillar IN ('trading','school','aura','builder')),
  processed    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Generated content drafts, one row per platform per signal
CREATE TABLE brand_drafts (
  id            SERIAL PRIMARY KEY,
  signal_id     INT REFERENCES brand_signals(id) ON DELETE CASCADE,
  platform      TEXT NOT NULL CHECK (platform IN ('x','linkedin','instagram','youtube')),
  content       JSONB NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','scheduled','published','failed','skipped')),
  scheduled_at  TIMESTAMPTZ,
  published_at  TIMESTAMPTZ,
  external_id   TEXT,
  error_msg     TEXT,
  retry_count   INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Engagement analytics pulled daily from each platform
CREATE TABLE brand_analytics (
  id            SERIAL PRIMARY KEY,
  draft_id      INT REFERENCES brand_drafts(id) ON DELETE CASCADE,
  platform      TEXT NOT NULL,
  impressions   INT DEFAULT 0,
  engagements  INT DEFAULT 0,
  likes         INT DEFAULT 0,
  reposts       INT DEFAULT 0,
  comments      INT DEFAULT 0,
  follows_gained INT DEFAULT 0,
  fetched_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Voice model versions — system prompt + few-shot examples from top performers
CREATE TABLE brand_voice_model (
  id          SERIAL PRIMARY KEY,
  version     INT NOT NULL UNIQUE,
  system_prompt TEXT NOT NULL,
  examples    JSONB NOT NULL DEFAULT '[]'::jsonb,
  active      BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one active voice model at a time
CREATE UNIQUE INDEX brand_voice_model_active_idx ON brand_voice_model(active) WHERE active = TRUE;

-- Content fingerprints for deduplication (prevents same idea within 7 days)
CREATE TABLE brand_content_fingerprints (
  id          SERIAL PRIMARY KEY,
  fingerprint TEXT NOT NULL UNIQUE,
  draft_id    INT REFERENCES brand_drafts(id),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

-- Indexes for common queries
CREATE INDEX brand_signals_processed_idx ON brand_signals(processed, created_at DESC);
CREATE INDEX brand_drafts_status_idx ON brand_drafts(status, scheduled_at);
CREATE INDEX brand_drafts_platform_idx ON brand_drafts(platform, status);
CREATE INDEX brand_analytics_draft_idx ON brand_analytics(draft_id, fetched_at DESC);
