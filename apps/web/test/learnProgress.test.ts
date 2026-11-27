import { describe, expect, it } from "vitest";
import {
  applyProgress,
  completionFor,
  continueTarget,
  createProgressWriteQueue,
  emptyProgressStore,
  exportProgressSummary,
  lessonStatus,
  mergeProgressStores,
  parseProgressStore,
  rollupCompletion,
  type LessonLocator,
  type ProgressStore,
  type RollupLesson,
} from "../lib/lessons/progress";

const lesson: LessonLocator = {
  lessonId: "caps:foundation:g1:english-home-language:t1:w1",
  href: "/learn/foundation/grade-01/english-home-language/term/1/week/1",
  title: "Listening and speaking",
  subject: "English Home Language",
  grade: 1,
  phase: "foundation",
  term: 1,
  week: 1,
  topic: "Listening and speaking (T1 W1)",
  nextHref: "/learn/foundation/grade-01/english-home-language/term/1/week/2",
  nextTitle: "Phonics and word building",
};

const lessons: RollupLesson[] = [
  { id: lesson.lessonId, subject: lesson.subject, grade: 1, term: 1, termWeighting: 2 },
  { id: "caps:foundation:g1:english-home-language:t1:w2", subject: lesson.subject, grade: 1, term: 1, termWeighting: 1 },
  { id: "caps:fet:g10:mathematics:t1:w1", subject: "Mathematics", grade: 10, term: 1 },
];

describe("learn progress", () => {
  it("moves a lesson from not started to in progress and completed", () => {
    let store = emptyProgressStore();
    expect(lessonStatus(store, lesson.lessonId)).toBe("not_started");
    store = applyProgress(store, {
      type: "visit_section",
      lesson,
      sectionId: "explanation-1",
      at: "2026-11-27T08:00:00.000Z",
    });
    store = applyProgress(store, {
      type: "visit_section",
      lesson,
      sectionId: "explanation-1",
      at: "2026-11-27T08:05:00.000Z",
    });
    expect(lessonStatus(store, lesson.lessonId)).toBe("in_progress");
    expect(store.records[lesson.lessonId]?.sectionsVisited).toEqual(["explanation-1"]);
    store = applyProgress(store, { type: "complete", lesson, at: "2026-11-27T08:30:00.000Z" });
    expect(lessonStatus(store, lesson.lessonId)).toBe("completed");
    expect(store.records[lesson.lessonId]?.completedAt).toBe("2026-11-27T08:30:00.000Z");
    expect(continueTarget(store)?.href).toBe(lesson.nextHref);
  });

  it("scores quick checks and ignores reveal-only attempts", () => {
    let store = applyProgress(emptyProgressStore(), {
      type: "quick_check",
      lesson,
      checkId: "check-focus",
      correct: false,
      selected: "Skip the topic",
      countsTowardScore: true,
      at: "2026-11-27T09:00:00.000Z",
    });
    store = applyProgress(store, {
      type: "quick_check",
      lesson,
      checkId: "check-focus",
      correct: true,
      selected: "Focus on listening",
      countsTowardScore: true,
      at: "2026-11-27T09:02:00.000Z",
    });
    store = applyProgress(store, {
      type: "quick_check",
      lesson,
      checkId: "reveal-1",
      correct: false,
      selected: "revealed",
      countsTowardScore: false,
      at: "2026-11-27T09:03:00.000Z",
    });
    expect(store.records[lesson.lessonId]?.scorePercent).toBe(100);
    expect(store.records[lesson.lessonId]?.quickCheckAttempts).toHaveLength(3);
    expect(store.records[lesson.lessonId]?.lastStudiedAt).toBe("2026-11-27T09:03:00.000Z");
  });

  it("rolls completion up by subject, grade, and term, with term weighting", () => {
    const store = applyProgress(emptyProgressStore(), {
      type: "complete",
      lesson,
      at: "2026-11-27T10:00:00.000Z",
    });
    const rollup = rollupCompletion(store, lessons);
    expect(rollup.overall).toMatchObject({ total: 3, completed: 1, percent: 33, weightedPercent: 50 });
    expect(rollup.bySubject.find((item) => item.key === "English Home Language")?.percent).toBe(50);
    expect(rollup.byGrade.find((item) => item.key === "1")?.completed).toBe(1);
    expect(rollup.byTerm.find((item) => item.key === "1:English Home Language:1")?.completed).toBe(1);
    expect(completionFor(store, lessons.map((item) => item.id)).notStarted).toBe(2);
  });

  it("stamps optional school fields onto records and exports an aggregatable summary", () => {
    let store = applyProgress(emptyProgressStore(), {
      type: "set_context",
      context: {
        institutionId: "inst-1",
        classId: "class-4a",
        cohortId: "2026",
        curriculumStandard: "CAPS",
        termWeighting: 2,
      },
      at: "2026-11-27T11:00:00.000Z",
    });
    store = applyProgress(store, { type: "visit_section", lesson, sectionId: "explanation-1", at: "2026-11-27T11:05:00.000Z" });
    const record = store.records[lesson.lessonId];
    expect(record).toMatchObject({
      institutionId: "inst-1",
      classId: "class-4a",
      cohortId: "2026",
      curriculumStandard: "CAPS",
      termWeighting: 2,
    });

    const summary = exportProgressSummary(store, lessons, "2026-11-27T12:00:00.000Z");
    expect(summary.schema).toBe("school.learn.progress.summary.v1");
    expect(summary.context.institutionId).toBe("inst-1");
    expect(summary.lessons).toHaveLength(1);
    expect(summary.lessons[0]).toMatchObject({
      lessonId: lesson.lessonId,
      status: "in_progress",
      classId: "class-4a",
      sectionsVisited: 1,
    });
  });

  it("merges device and account copies by the later study time and drops malformed records", () => {
    const older = applyProgress(emptyProgressStore(), {
      type: "visit_section",
      lesson,
      sectionId: "explanation-1",
      at: "2026-11-27T08:00:00.000Z",
    });
    const newer = applyProgress(emptyProgressStore(), {
      type: "complete",
      lesson,
      at: "2026-11-27T09:00:00.000Z",
    });
    const merged = mergeProgressStores(older, newer);
    expect(merged.records[lesson.lessonId]?.status).toBe("completed");

    const parsed = parseProgressStore({
      version: 1,
      context: { institutionId: "  ", classId: "7B" },
      records: {
        bad: { lessonId: "x" },
        good: newer.records[lesson.lessonId],
      },
    });
    expect(parsed.context).toEqual({ classId: "7B" });
    expect(Object.keys(parsed.records)).toEqual([lesson.lessonId]);
    expect(parseProgressStore(null).records).toEqual({});
  });

  it("keeps a newer saved lesson when a stale full snapshot arrives later", () => {
    const saved = applyProgress(emptyProgressStore(), {
      type: "complete",
      lesson,
      at: "2026-11-27T09:00:00.000Z",
    });
    const other = {
      ...lesson,
      lessonId: "caps:foundation:g1:english-home-language:t1:w2",
      href: lesson.nextHref || lesson.href,
      title: "Phonics",
      week: 2,
    };
    const stale = applyProgress(emptyProgressStore(), {
      type: "visit_section",
      lesson: other,
      sectionId: "explanation-1",
      at: "2026-11-27T08:00:00.000Z",
    });
    const merged = mergeProgressStores(saved, stale);
    expect(merged.records[lesson.lessonId]?.status).toBe("completed");
    expect(merged.records[other.lessonId]?.status).toBe("in_progress");
  });

  it("sends only the newest progress snapshot queued before an upload starts", async () => {
    const sent: string[] = [];
    const enqueue = createProgressWriteQueue(async (store: ProgressStore) => {
      sent.push(store.records[lesson.lessonId]?.sectionsVisited.join("+") ?? "");
      return true;
    });
    const first = applyProgress(emptyProgressStore(), {
      type: "visit_section",
      lesson,
      sectionId: "explanation-1",
      at: "2026-11-27T08:00:00.000Z",
    });
    const second = applyProgress(first, {
      type: "visit_section",
      lesson,
      sectionId: "example-1",
      at: "2026-11-27T08:01:00.000Z",
    });
    await Promise.all([enqueue(first), enqueue(second)]);
    expect(sent).toEqual(["explanation-1+example-1"]);
  });

  it("uploads the next snapshot only after the in-flight save returns", async () => {
    const sent: string[] = [];
    let releaseFirst: (() => void) | null = null;
    const enqueue = createProgressWriteQueue(async (store: ProgressStore) => {
      sent.push(store.records[lesson.lessonId]?.status ?? "");
      if (sent.length === 1) {
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
      }
      return true;
    });
    const first = applyProgress(emptyProgressStore(), {
      type: "visit_section",
      lesson,
      sectionId: "explanation-1",
      at: "2026-11-27T08:00:00.000Z",
    });
    const started = enqueue(first);
    await Promise.resolve();
    const second = applyProgress(first, {
      type: "complete",
      lesson,
      at: "2026-11-27T08:05:00.000Z",
    });
    const followed = enqueue(second);
    await Promise.resolve();
    expect(sent).toEqual(["in_progress"]);
    releaseFirst?.();
    await started;
    await followed;
    expect(sent).toEqual(["in_progress", "completed"]);
  });

  it("sends a finished learner to the next lesson", () => {
    const store = applyProgress(emptyProgressStore(), {
      type: "complete",
      lesson,
      at: "2026-11-27T12:00:00.000Z",
    });
    expect(continueTarget(store)).toMatchObject({
      href: lesson.nextHref,
      title: "Phonics and word building",
    });
  });
});
