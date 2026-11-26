export type TopicSignalInput = {
  userId: string;
  sessionId: string;
  topic: string;
  subject: string;
  gradeInferred: number | null;
  weaknessDetected: boolean;
  difficultyLevel: number;
};

function clampDifficulty(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 3;
  return Math.max(1, Math.min(5, Math.round(value)));
}

function normalizeGrade(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= 1 && rounded <= 12 ? rounded : null;
}

/**
 * The authenticated user id is an argument, never read from the body.
 */
export function parseTopicSignalBody(
  body: unknown,
  userId: string,
): { ok: true; value: TopicSignalInput } | { ok: false; error: string } {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const sessionId = typeof record.sessionId === "string" ? record.sessionId.trim() : "";
  const topic = typeof record.topic === "string" ? record.topic.trim() : "";
  const subject = typeof record.subject === "string" ? record.subject.trim() : "";
  if (!userId || !sessionId || !topic || !subject) {
    return { ok: false, error: "sessionId, topic, and subject are required." };
  }
  return {
    ok: true,
    value: {
      userId,
      sessionId,
      topic,
      subject,
      gradeInferred: normalizeGrade(record.grade_inferred),
      weaknessDetected: record.weakness_detected === true,
      difficultyLevel: clampDifficulty(record.difficulty_level),
    },
  };
}
