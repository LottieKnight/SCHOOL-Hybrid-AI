import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/pastPapers/db";
import { getUserContextFromRequest } from "@/lib/pastPapers/auth";
import { ensureLearningArtifactTables } from "@/lib/learning/schema";
import { getInstitutionContextForUser } from "@/lib/server/institutions";

export const dynamic = "force-dynamic";

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

export async function GET(_request: NextRequest) {
  const { userId } = await getUserContextFromRequest();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureLearningArtifactTables();
  const [institution, sessions, artifacts] = await Promise.all([
    getInstitutionContextForUser(userId).catch(() => null),
    db.findMany("LearningSession", {
      where: { userId },
      select: ["id", "kind", "subject", "title", "status", "createdAt"],
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    db.findMany("RevisionArtifact", {
      where: { userId, status: "saved" },
      select: ["id", "title", "sourceType", "plannerStatus", "createdAt"],
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
  ]);

  const subjectCounts = new Map<string, number>();
  for (const session of sessions) {
    const subject = typeof session.subject === "string" && session.subject.trim() ? session.subject.trim() : "Cross-module study";
    subjectCounts.set(subject, (subjectCounts.get(subject) ?? 0) + 1);
  }

  const modules = institution?.currentModules ?? [];
  const scheduled = artifacts.filter((artifact) => artifact.plannerStatus === "scheduled").length;
  const completed = artifacts.filter((artifact) => artifact.plannerStatus === "completed").length;
  const skipped = artifacts.filter((artifact) => artifact.plannerStatus === "skipped").length;
  const activeModuleCount = modules.filter((module) => subjectCounts.has(module)).length;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    institution: institution
      ? {
          id: institution.id,
          name: institution.name,
          shortName: institution.shortName,
          faculty: institution.faculty,
          academicPeriodType: institution.academicPeriodType,
        }
      : null,
    modules,
    metrics: {
      sessions: sessions.length,
      artifacts: artifacts.length,
      scheduled,
      completed,
      skipped,
      activeModuleCount,
    },
    subjects: Array.from(subjectCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 4),
    recentEvidence: artifacts.slice(0, 3).map((artifact) => ({
      id: String(artifact.id),
      title: String(artifact.title ?? "Learning artifact"),
      sourceType: artifact.sourceType ? String(artifact.sourceType) : null,
      createdAt: toIso(artifact.createdAt),
    })),
  });
}
