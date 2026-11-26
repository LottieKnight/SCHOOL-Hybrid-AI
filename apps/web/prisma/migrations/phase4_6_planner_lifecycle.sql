-- Phase 4.6: lifecycle state for revision-artifact planner tasks.
ALTER TABLE "RevisionArtifact" ADD COLUMN "plannerStatus" TEXT;
ALTER TABLE "RevisionArtifact" ADD COLUMN "plannerEventId" TEXT;
ALTER TABLE "RevisionArtifact" ADD COLUMN "plannerCompletedAt" INTEGER;
ALTER TABLE "RevisionArtifact" ADD COLUMN "plannerSkippedAt" INTEGER;
