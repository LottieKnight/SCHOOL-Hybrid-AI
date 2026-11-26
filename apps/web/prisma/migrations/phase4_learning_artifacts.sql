-- Phase 4: durable learning sessions and learner-owned revision artifacts.
-- Safe to apply repeatedly in local SQLite/D1-compatible environments.

CREATE TABLE IF NOT EXISTS "LearningSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "title" TEXT NOT NULL,
  "subject" TEXT,
  "grade" INTEGER,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "summaryJson" TEXT,
  "startedAt" INTEGER NOT NULL,
  "completedAt" INTEGER,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "LearningSession_userId_createdAt_idx"
  ON "LearningSession" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "LearningSession_userId_kind_status_idx"
  ON "LearningSession" ("userId", "kind", "status");
CREATE INDEX IF NOT EXISTS "LearningSession_sourceType_sourceId_idx"
  ON "LearningSession" ("sourceType", "sourceId");

CREATE TABLE IF NOT EXISTS "RevisionArtifact" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "sessionId" TEXT,
  "artifactType" TEXT NOT NULL DEFAULT 'session_summary',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "evidenceJson" TEXT,
  "status" TEXT NOT NULL DEFAULT 'saved',
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "RevisionArtifact_userId_createdAt_idx"
  ON "RevisionArtifact" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "RevisionArtifact_userId_artifactType_status_idx"
  ON "RevisionArtifact" ("userId", "artifactType", "status");
CREATE INDEX IF NOT EXISTS "RevisionArtifact_sessionId_idx"
  ON "RevisionArtifact" ("sessionId");
