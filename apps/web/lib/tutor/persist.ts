import "server-only";
import { db } from "@/lib/pastPapers/db";
import { ensureLearningArtifactTables } from "@/lib/learning/schema";
import { ensurePastPaperQuestions } from "@/lib/pastPapers/questions";
import { buildRevisionNote, type RevisionNoteDraft } from "@/lib/hybridTutor/revisionNote";
import { pickWeighted, weightCandidates, type CandidateQuestion, type WeakSignal } from "@/lib/hybridTutor/sitting";
import type { PlanPayload } from "@/lib/hybridTutor/schemas";

const TUTOR_SOURCE = "SCHOOL Tutor";

async function tutorSourceId() {
  const existing = await db.findFirst("PastPaperSource", { where: { name: TUTOR_SOURCE } });
  if (existing?.id) return String(existing.id);
  const created = await db.create("PastPaperSource", {
    name: TUTOR_SOURCE,
    baseUrl: "https://school.ditshego-ventures.co.za/tutor",
    robotsRespectNote: "Original SCHOOL practice prompts. Not a copy of an external question bank.",
  });
  return String(created.id);
}

export async function ensureTutorPaper(subject: string, grade?: number | null) {
  const sourceId = await tutorSourceId();
  const year = new Date().getFullYear();
  const safeSubject = subject.trim() || "CAPS";
  const safeGrade = grade ?? 12;
  const existing = await db.findFirst("PastPaper", {
    where: {
      sourceId,
      province: "National",
      grade: safeGrade,
      subject: safeSubject,
      year,
      session: "Tutor",
      paperNumber: "practice",
      language: "en",
    },
  });
  if (existing?.id) return existing;
  return db.create("PastPaper", {
    sourceId,
    province: "National",
    grade: safeGrade,
    subject: safeSubject,
    year,
    session: "Tutor",
    paperNumber: "practice",
    language: "en",
    title: `${safeSubject} tutor practice`,
    totalMarks: null,
  });
}

async function ensureQuestion(pastPaperId: string, label: string, maxMarks: number, topic?: string) {
  const existing = await db.findMany("PastPaperQuestion", {
    where: { pastPaperId },
    orderBy: { orderIndex: "asc" },
  });
  const match = existing.find((row) => String(row.label) === label);
  if (match) return match;
  return db.create("PastPaperQuestion", {
    pastPaperId,
    qNumber: `Q${existing.length + 1}`,
    label: label.slice(0, 500) || "Question",
    maxMarks: Math.max(1, Math.round(maxMarks || 1)),
    topicTags: topic?.slice(0, 180) ?? null,
    orderIndex: existing.length + 1,
  });
}

export async function saveRevisionNote(userId: string, note: RevisionNoteDraft, sessionId?: string | null) {
  await ensureLearningArtifactTables();
  const existing = await db.findFirst("RevisionArtifact", {
    where: { userId, sourceType: note.sourceType, sourceId: note.sourceId, artifactType: "error_revision" },
  });
  const evidence = JSON.stringify({
    errorPatterns: note.errorPatterns,
    followUp: note.followUp,
    sourceQuestionId: note.sourceId,
  });
  if (existing?.id) {
    await db.update(
      "RevisionArtifact",
      { id: String(existing.id) },
      { title: note.title.slice(0, 180), body: note.body, evidenceJson: evidence, sessionId: sessionId ?? null },
    );
    return { artifactId: String(existing.id), followUp: note.followUp };
  }
  const created = await db.create("RevisionArtifact", {
    userId,
    sessionId: sessionId ?? null,
    artifactType: "error_revision",
    title: note.title.slice(0, 180),
    body: note.body,
    sourceType: note.sourceType,
    sourceId: note.sourceId,
    evidenceJson: evidence,
    status: "saved",
  });
  return { artifactId: String(created.id), followUp: note.followUp };
}

export async function recordMarkedAnswer(input: {
  userId: string;
  pastPaperId?: string | null;
  subject: string;
  grade?: number | null;
  questionLabel: string;
  maxMarks: number;
  answerText: string;
  score: number;
  outOf: number;
  feedback: string;
  missedSteps: string[];
  topic?: string;
}) {
  const paper = input.pastPaperId
    ? await db.findFirst("PastPaper", { where: { id: input.pastPaperId } })
    : await ensureTutorPaper(input.subject, input.grade);
  if (!paper?.id) throw new Error("Past paper not found.");
  const question = await ensureQuestion(String(paper.id), input.questionLabel, input.maxMarks, input.topic);
  const attempt = await db.create("PastPaperAttempt", {
    userId: input.userId,
    pastPaperId: String(paper.id),
    status: "marked",
    submittedAt: new Date(),
    markedAt: new Date(),
    totalScore: input.score,
    totalMax: input.outOf,
    analyticsJson: JSON.stringify({ kind: "mark", topic: input.topic ?? input.subject }),
  });
  await db.create("PastPaperAnswer", {
    attemptId: String(attempt.id),
    questionId: String(question.id),
    answerText: input.answerText.slice(0, 8000),
    autoScore: input.score,
    maxMarks: input.outOf,
    feedback: input.feedback.slice(0, 2000),
  });
  const note = buildRevisionNote({
    questionId: String(question.id),
    questionLabel: input.questionLabel,
    topic: input.topic || input.subject,
    subject: input.subject,
    missedSteps: input.missedSteps,
    score: input.score,
    outOf: input.outOf,
  });
  const saved = await saveRevisionNote(input.userId, note, String(attempt.id));
  return {
    paperId: String(paper.id),
    attemptId: String(attempt.id),
    questionId: String(question.id),
    artifactId: saved.artifactId,
    followUp: saved.followUp,
  };
}

export async function recordPaperPlan(input: {
  userId: string;
  pastPaperId?: string | null;
  subject: string;
  grade?: number | null;
  plan: PlanPayload;
}) {
  const paper = input.pastPaperId
    ? await db.findFirst("PastPaper", { where: { id: input.pastPaperId } })
    : await ensureTutorPaper(input.plan.subject || input.subject, input.grade);
  if (!paper?.id) throw new Error("Past paper not found.");
  const attempt = await db.create("PastPaperAttempt", {
    userId: input.userId,
    pastPaperId: String(paper.id),
    status: "planned",
    analyticsJson: JSON.stringify({ kind: "plan", plan: input.plan }),
  });
  const topics = (input.plan.topics.length ? input.plan.topics : [{ name: input.plan.subject || input.subject, marks: 0, priority: "medium" as const }])
    .filter((topic, index, list) => list.findIndex((item) => item.name === topic.name) === index);
  for (const topic of topics) {
    const question = await ensureQuestion(String(paper.id), topic.name, topic.marks || 1, topic.name);
    const day = input.plan.plan.find((item) => item.focus.toLowerCase().includes(topic.name.toLowerCase())) ?? input.plan.plan[0];
    await db.create("PastPaperAnswer", {
      attemptId: String(attempt.id),
      questionId: String(question.id),
      answerText: (day?.tasks ?? ["Revise this topic."]).join("\n").slice(0, 4000),
      maxMarks: topic.marks || null,
      feedback: day?.focus ?? "Planned revision",
      attachmentsJson: JSON.stringify({ role: "plan_task", priority: topic.priority, day: day?.day ?? null }),
    });
  }
  return { paperId: String(paper.id), attemptId: String(attempt.id) };
}

type QuestionRow = {
  id: string;
  pastPaperId: string;
  qNumber: string;
  label: string;
  maxMarks: number | null;
  topicTags: string | null;
  subject: string;
  grade: number | null;
  title: string;
};

async function loadCandidates(filter: { subject?: string | null; grade?: number | null } = {}): Promise<CandidateQuestion[]> {
  const subject = filter.subject?.trim() ?? "";
  const grade = filter.grade ?? null;
  const rows = (await db.raw(
    `SELECT q.id AS id, q.pastPaperId AS pastPaperId, q.qNumber AS qNumber, q.label AS label,
            q.maxMarks AS maxMarks, q.topicTags AS topicTags, p.subject AS subject, p.grade AS grade, p.title AS title
     FROM PastPaperQuestion q
     JOIN PastPaper p ON p.id = q.pastPaperId
     JOIN PastPaperSource s ON s.id = p.sourceId
     WHERE p.grade IN (10, 11, 12)
       AND s.name != ?
       AND (? = '' OR lower(p.subject) = lower(?))
       AND (? IS NULL OR p.grade = ?)
     LIMIT 500`,
    [TUTOR_SOURCE, subject, subject, grade, grade],
  )) as QuestionRow[];
  return rows.map((row) => ({
    id: String(row.id),
    pastPaperId: String(row.pastPaperId),
    qNumber: String(row.qNumber),
    label: String(row.label),
    maxMarks: Number(row.maxMarks ?? 5),
    topicTags: row.topicTags ? String(row.topicTags) : null,
    subject: String(row.subject),
    grade: row.grade === null || row.grade === undefined ? null : Number(row.grade),
    title: String(row.title),
  }));
}

export async function buildWeightedSitting(input: {
  userId: string;
  minutes: number;
  limit?: number;
  weak?: WeakSignal[];
  subject?: string | null;
  grade?: number | null;
  random?: () => number;
}) {
  const limit = Math.max(1, Math.min(input.limit ?? 5, 8));
  const scope = { subject: input.subject, grade: input.grade };
  let candidates = await loadCandidates(scope);
  if (candidates.length < limit) {
    const subject = input.subject?.trim() ?? "";
    const grade = input.grade ?? null;
    const papers = (await db.raw(
      `SELECT p.id AS id, p.subject AS subject
       FROM PastPaper p
       JOIN PastPaperSource s ON s.id = p.sourceId
       WHERE p.grade IN (10, 11, 12)
         AND s.name != ?
         AND (? = '' OR lower(p.subject) = lower(?))
         AND (? IS NULL OR p.grade = ?)
       ORDER BY p.year DESC
       LIMIT 6`,
      [TUTOR_SOURCE, subject, subject, grade, grade],
    )) as Array<{ id: string; subject: string }>;
    for (const paper of papers.slice(0, 3)) {
      await ensurePastPaperQuestions(String(paper.id));
    }
    candidates = await loadCandidates(scope);
  }
  const weighted = weightCandidates(candidates, input.weak ?? []);
  const picked = pickWeighted(weighted, limit, input.random);
  const anchor = picked[0];
  if (!anchor) throw new Error("No Grade 10-12 questions are available for a sitting.");
  const attempt = await db.create("PastPaperAttempt", {
    userId: input.userId,
    pastPaperId: anchor.pastPaperId,
    status: "in_progress",
    totalMax: picked.reduce((sum, item) => sum + item.maxMarks, 0),
    analyticsJson: JSON.stringify({
      kind: "timed_sitting",
      minutes: input.minutes,
      questionIds: picked.map((item) => item.id),
      weak: input.weak ?? [],
    }),
  });
  return {
    attemptId: String(attempt.id),
    minutes: input.minutes,
    questions: picked.map(({ weight: _weight, ...question }) => question),
  };
}

export async function recordSittingReview(input: {
  userId: string;
  attemptId: string;
  questionId: string;
  answerText: string;
  score: number;
  outOf: number;
  feedback: string;
  missedSteps: string[];
  topic: string;
  subject: string;
  questionLabel: string;
  done: boolean;
}) {
  const attempt = await db.findFirst("PastPaperAttempt", { where: { id: input.attemptId, userId: input.userId } });
  if (!attempt) throw new Error("Sitting not found.");
  const existing = await db.findFirst("PastPaperAnswer", {
    where: { attemptId: input.attemptId, questionId: input.questionId },
  });
  if (existing?.id) {
    await db.update(
      "PastPaperAnswer",
      { id: String(existing.id) },
      {
        answerText: input.answerText.slice(0, 8000),
        autoScore: input.score,
        maxMarks: input.outOf,
        feedback: input.feedback.slice(0, 2000),
      },
    );
  } else {
    await db.create("PastPaperAnswer", {
      attemptId: input.attemptId,
      questionId: input.questionId,
      answerText: input.answerText.slice(0, 8000),
      autoScore: input.score,
      maxMarks: input.outOf,
      feedback: input.feedback.slice(0, 2000),
    });
  }
  const note = buildRevisionNote({
    questionId: input.questionId,
    questionLabel: input.questionLabel,
    topic: input.topic,
    subject: input.subject,
    missedSteps: input.missedSteps,
    score: input.score,
    outOf: input.outOf,
  });
  const saved = await saveRevisionNote(input.userId, note, input.attemptId);
  if (input.done) {
    const answers = await db.findMany("PastPaperAnswer", { where: { attemptId: input.attemptId } });
    const totalScore = answers.reduce((sum, row) => sum + Number(row.autoScore ?? 0), 0);
    const totalMax = answers.reduce((sum, row) => sum + Number(row.maxMarks ?? 0), 0);
    await db.update(
      "PastPaperAttempt",
      { id: input.attemptId, userId: input.userId },
      { status: "marked", submittedAt: new Date(), markedAt: new Date(), totalScore, totalMax },
    );
  }
  return { artifactId: saved.artifactId, followUp: saved.followUp };
}

async function ensureFamilyTable() {
  await db.run(
    `CREATE TABLE IF NOT EXISTS "FamilyShareLink" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "token" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "createdAt" INTEGER NOT NULL,
      "expiresAt" INTEGER
    )`,
  );
  await db.run(`CREATE UNIQUE INDEX IF NOT EXISTS "FamilyShareLink_token_idx" ON "FamilyShareLink" ("token")`);
}

export async function createFamilyLink(userId: string, now = Date.now()) {
  await ensureFamilyTable();
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const expiresAt = now + 1000 * 60 * 60 * 24 * 30;
  await db.create("FamilyShareLink", { token, userId, createdAt: now, expiresAt });
  return { token, expiresAt: new Date(expiresAt).toISOString() };
}

export async function readFamilyWeek(token: string, now = Date.now()) {
  await ensureFamilyTable();
  await ensureLearningArtifactTables();
  const link = await db.findFirst("FamilyShareLink", { where: { token } });
  if (!link) return null;
  const expires = link.expiresAt ? Number(link.expiresAt) : null;
  if (expires && expires < now) return null;
  const userId = String(link.userId);
  const since = now - 1000 * 60 * 60 * 24 * 7;
  const attempts = (await db.raw(
    `SELECT a.id AS id, a.status AS status, a.totalScore AS totalScore, a.totalMax AS totalMax,
            a.createdAt AS createdAt, a.analyticsJson AS analyticsJson, p.subject AS subject, p.title AS title
     FROM PastPaperAttempt a
     JOIN PastPaper p ON p.id = a.pastPaperId
     WHERE a.userId = ? AND a.createdAt >= ?
     ORDER BY a.createdAt DESC
     LIMIT 40`,
    [userId, since],
  )) as Array<Record<string, unknown>>;
  const scores = (await db.raw(
    `SELECT p.subject AS subject, AVG(CASE WHEN ans.maxMarks > 0 THEN (ans.autoScore * 100.0 / ans.maxMarks) ELSE NULL END) AS avgScore, COUNT(*) AS attempts
     FROM PastPaperAnswer ans
     JOIN PastPaperAttempt a ON a.id = ans.attemptId
     JOIN PastPaper p ON p.id = a.pastPaperId
     WHERE a.userId = ? AND ans.autoScore IS NOT NULL
     GROUP BY p.subject
     ORDER BY avgScore ASC
     LIMIT 6`,
    [userId],
  )) as Array<Record<string, unknown>>;
  const notes = await db.findMany("RevisionArtifact", {
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const quizzes = attempts.filter((row) => row.status === "marked");
  const plans = attempts.filter((row) => row.status === "planned");
  return {
    generatedAt: new Date(now).toISOString(),
    quizzes: quizzes.map((row) => ({
      id: String(row.id),
      subject: String(row.subject ?? ""),
      title: String(row.title ?? ""),
      score: row.totalScore === null || row.totalScore === undefined ? null : Number(row.totalScore),
      outOf: row.totalMax === null || row.totalMax === undefined ? null : Number(row.totalMax),
    })),
    plans: plans.map((row) => ({
      id: String(row.id),
      subject: String(row.subject ?? ""),
      title: String(row.title ?? ""),
    })),
    weakTopics: scores.map((row) => ({
      subject: String(row.subject ?? ""),
      avgScore: row.avgScore === null || row.avgScore === undefined ? null : Math.round(Number(row.avgScore)),
      attempts: Number(row.attempts ?? 0),
    })),
    tutorSessions: notes.map((row) => ({
      id: String(row.id),
      title: String(row.title ?? ""),
      body: String(row.body ?? ""),
      artifactType: String(row.artifactType ?? ""),
    })),
  };
}
