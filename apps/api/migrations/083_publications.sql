-- SCHOOL Press — publishing surface for scholarly and creative works.
--
-- One imprint ("SCHOOL Press") over a single `works` object. Written work
-- (papers, essays, literature) and visual work (artistic / design pieces) share
-- the same pipeline and differ only by `layout` ('written' | 'gallery').
--
-- Deliberately separate from the research_* tables (migration 082): Research is
-- ethics-bound data collection; Press is published output. Keeping the brands
-- apart protects the credibility of the research programme.
--
-- Design notes:
--   * File references follow the existing codebase convention (*_url TEXT plus an
--     optional storage_key, image_urls TEXT[] for galleries) — there is no
--     central files table to FK against.
--   * Authorship is CASCADE on the account: deleting an account removes the
--     author's works. (To instead keep works as pseudonymous credits, switch
--     works.author_id to ON DELETE SET NULL and make it nullable.)
--   * doi is reserved for the v3 Zenodo/DataCite integration; v1 never sets it.
--   * See docs/product/school-press.md for the full spec and rollout phases.

-- 1. Works ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS works (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind             TEXT NOT NULL
        CHECK (kind IN ('paper', 'essay', 'literature', 'design', 'dataset_note', 'other')),
    layout           TEXT NOT NULL DEFAULT 'written'
        CHECK (layout IN ('written', 'gallery')),
    title            TEXT NOT NULL,
    slug             TEXT NOT NULL UNIQUE,
    abstract         TEXT,                                  -- or artist's statement for gallery works
    body_md          TEXT,                                  -- optional inline content (essays, poems)
    discipline_tags  TEXT[] NOT NULL DEFAULT '{}',
    license          TEXT NOT NULL DEFAULT 'CC-BY-4.0'
        CHECK (license IN ('CC-BY-4.0', 'CC-BY-SA-4.0', 'CC-BY-NC-4.0', 'CC-BY-NC-SA-4.0',
                           'CC-BY-ND-4.0', 'CC0-1.0', 'all-rights-reserved')),
    status           TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'curated', 'withdrawn')),
    doi              TEXT UNIQUE,                           -- minted on publish in v3 (Zenodo); null in v1
    cover_url        TEXT,
    cover_storage_key TEXT,
    published_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_works_author    ON works(author_id, status);
CREATE INDEX IF NOT EXISTS idx_works_layout    ON works(layout, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_works_published ON works(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_works_tags      ON works USING GIN (discipline_tags);

-- 2. Versions ---------------------------------------------------------------
-- A work can have many versions; the latest is the canonical render. In v3 the
-- concept DOI resolves to the newest version.
CREATE TABLE IF NOT EXISTS work_versions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_id      UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    version      INTEGER NOT NULL,
    file_url     TEXT,                                      -- the PDF / primary asset
    storage_key  TEXT,
    image_urls   TEXT[] NOT NULL DEFAULT '{}',              -- gallery works (one or many images)
    changelog    TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (work_id, version)
);

CREATE INDEX IF NOT EXISTS idx_work_versions_work ON work_versions(work_id, version DESC);

-- 3. Authors ----------------------------------------------------------------
-- Ordered co-authors. display_name is always stored so external collaborators
-- (no SCHOOL account) still render; user_id links the credit when they have one.
CREATE TABLE IF NOT EXISTS work_authors (
    work_id      UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    display_name TEXT NOT NULL,
    affiliation  TEXT,
    ord          INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (work_id, ord)
);

CREATE INDEX IF NOT EXISTS idx_work_authors_user ON work_authors(user_id);

-- 4. References -------------------------------------------------------------
-- Free-text reference list (citation graph v1 — stored as typed, no resolver).
CREATE TABLE IF NOT EXISTS work_references (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_id   UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    raw       TEXT NOT NULL,
    doi       TEXT,
    ord       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_work_references_work ON work_references(work_id, ord);
