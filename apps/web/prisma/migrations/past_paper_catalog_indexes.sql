-- Catalogue indexes for the past-papers browse query.
-- The default list filters ready rows and sorts by year, subject, and paper.
-- Partial indexes keep that path off a full table scan as the catalogue grows
-- (SQLite locally and the D1 import, which copies sqlite_master indexes).

CREATE INDEX IF NOT EXISTS "PastPaper_catalog_ready_idx"
  ON "PastPaper" ("year" DESC, "subject", "paperNumber")
  WHERE "paperStorageKey" IS NOT NULL
    AND "grade" IS NOT NULL
    AND "year" IS NOT NULL
    AND "subject" != 'Unknown';

CREATE INDEX IF NOT EXISTS "PastPaper_catalog_grade_year_idx"
  ON "PastPaper" ("grade", "year" DESC, "subject")
  WHERE "paperStorageKey" IS NOT NULL
    AND "year" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "PastPaper_catalog_subject_idx"
  ON "PastPaper" ("subject");

CREATE INDEX IF NOT EXISTS "PastPaper_catalog_language_idx"
  ON "PastPaper" ("language");

CREATE INDEX IF NOT EXISTS "PastPaper_catalog_session_idx"
  ON "PastPaper" ("session");

CREATE INDEX IF NOT EXISTS "PastPaper_catalog_memo_idx"
  ON "PastPaper" ("memoStorageKey");
