import "server-only";
import { db } from "@/lib/pastPapers/db";
import { ensureLearningArtifactTables } from "@/lib/learning/schema";

export type CaptureInput = {
  userId: string;
  kind: string;
  title: string;
  subject?: string | null;
  sourceType: string;
  sourceId: string;
  takeaways: string[];
  nextAction: string;
  evidence?: unknown[];
};

export async function captureLearningSession(input: CaptureInput) {
  await ensureLearningArtifactTables();
  const existing = await db.findFirst("RevisionArtifact", {
    where: { userId: input.userId, sourceType: input.sourceType, sourceId: input.sourceId },
    select: ["id", "sessionId"],
  });
  if (existing) {
    return { sessionId: String(existing.sessionId ?? ""), artifactId: String(existing.id) };
  }
  const summaryJson = JSON.stringify({ takeaways: input.takeaways, nextAction: input.nextAction, evidence: input.evidence ?? [] });
  const session = await db.create("LearningSession", {
    userId: input.userId,
    kind: input.kind,
    status: "completed",
    title: input.title.slice(0, 180),
    subject: input.subject?.slice(0, 120) ?? null,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    summaryJson,
    startedAt: new Date(),
    completedAt: new Date(),
  });
  const artifact = await db.create("RevisionArtifact", {
    userId: input.userId,
    sessionId: String(session.id),
    artifactType: "session_summary",
    title: input.title.slice(0, 180),
    body: `${input.takeaways.map((item) => `• ${item}`).join("\n")}\n\nNext action: ${input.nextAction.slice(0, 300)}`,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    evidenceJson: JSON.stringify(input.evidence ?? []),
    status: "saved",
  });
  return { sessionId: String(session.id), artifactId: String(artifact.id) };
}
