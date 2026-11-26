import "server-only";
import { db } from "@/lib/pastPapers/db";

let ensured = false;

export async function ensureLearningArtifactTables() {
  if (ensured) return;
  await db.run(`CREATE TABLE IF NOT EXISTS "LearningSession" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "kind" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'completed', "title" TEXT NOT NULL, "subject" TEXT, "grade" INTEGER, "sourceType" TEXT, "sourceId" TEXT, "summaryJson" TEXT, "startedAt" INTEGER NOT NULL, "completedAt" INTEGER, "createdAt" INTEGER NOT NULL, "updatedAt" INTEGER NOT NULL)`);
  await db.run(`CREATE TABLE IF NOT EXISTS "RevisionArtifact" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "sessionId" TEXT, "artifactType" TEXT NOT NULL DEFAULT 'session_summary', "title" TEXT NOT NULL, "body" TEXT NOT NULL, "sourceType" TEXT, "sourceId" TEXT, "evidenceJson" TEXT, "status" TEXT NOT NULL DEFAULT 'saved', "createdAt" INTEGER NOT NULL, "updatedAt" INTEGER NOT NULL)`);
  for (const column of [
    `ALTER TABLE "RevisionArtifact" ADD COLUMN "plannerStatus" TEXT`,
    `ALTER TABLE "RevisionArtifact" ADD COLUMN "plannerEventId" TEXT`,
    `ALTER TABLE "RevisionArtifact" ADD COLUMN "plannerCompletedAt" INTEGER`,
    `ALTER TABLE "RevisionArtifact" ADD COLUMN "plannerSkippedAt" INTEGER`,
  ]) {
    try { await db.run(column); } catch { /* Column already exists. */ }
  }
  await db.run(`CREATE INDEX IF NOT EXISTS "LearningSession_userId_createdAt_idx" ON "LearningSession" ("userId", "createdAt")`);
  await db.run(`CREATE INDEX IF NOT EXISTS "RevisionArtifact_userId_createdAt_idx" ON "RevisionArtifact" ("userId", "createdAt")`);
  ensured = true;
}
