/**
 * Lesson progress is a plain JSON document.
 * The browser keeps a copy immediately. Signed-in learners can also store the
 * same document on their existing profile preferences. Nothing here touches
 * Node or the database, so the maths can run in the client and in tests.
 */

export type LessonStatus = "not_started" | "in_progress" | "completed";

export type InstitutionalContext = {
  institutionId?: string;
  classId?: string;
  cohortId?: string;
  curriculumStandard?: string;
  termWeighting?: number;
};

export type LessonLocator = {
  lessonId: string;
  href: string;
  title: string;
  subject: string;
  grade: number;
  phase: string;
  term: number;
  week: number;
  topic: string;
  nextHref?: string | null;
  nextTitle?: string | null;
  termWeighting?: number;
};

export type QuickCheckAttempt = {
  checkId: string;
  correct: boolean;
  selected: string;
  at: string;
  countsTowardScore: boolean;
};

export type LessonProgressRecord = LessonLocator &
  InstitutionalContext & {
    status: LessonStatus;
    sectionsVisited: string[];
    quickCheckAttempts: QuickCheckAttempt[];
    scorePercent: number | null;
    lastStudiedAt: string | null;
    completedAt: string | null;
  };

export type ProgressStore = {
  version: 1;
  context: InstitutionalContext;
  records: Record<string, LessonProgressRecord>;
};

export type ProgressEvent =
  | { type: "visit_section"; lesson: LessonLocator; sectionId: string; at: string }
  | {
      type: "quick_check";
      lesson: LessonLocator;
      checkId: string;
      correct: boolean;
      selected: string;
      countsTowardScore: boolean;
      at: string;
    }
  | { type: "complete"; lesson: LessonLocator; at: string }
  | { type: "set_context"; context: InstitutionalContext; at: string };

export type ScopeStat = {
  key: string;
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  percent: number;
  weightedPercent: number;
};

export type RollupLesson = {
  id: string;
  subject: string;
  grade: number;
  term: number;
  termWeighting?: number;
};

const MAX_ATTEMPTS = 12;
const MAX_RECORDS = 2000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cleanContext(value: unknown): InstitutionalContext {
  if (!isRecord(value)) return {};
  const context: InstitutionalContext = {};
  const institutionId = asString(value.institutionId);
  const classId = asString(value.classId);
  const cohortId = asString(value.cohortId);
  const curriculumStandard = asString(value.curriculumStandard);
  const termWeighting = asNumber(value.termWeighting);
  if (institutionId) context.institutionId = institutionId;
  if (classId) context.classId = classId;
  if (cohortId) context.cohortId = cohortId;
  if (curriculumStandard) context.curriculumStandard = curriculumStandard;
  if (termWeighting !== null && termWeighting > 0) context.termWeighting = termWeighting;
  return context;
}

function stampContext(record: LessonProgressRecord, context: InstitutionalContext): LessonProgressRecord {
  return {
    ...record,
    institutionId: context.institutionId,
    classId: context.classId,
    cohortId: context.cohortId,
    curriculumStandard: context.curriculumStandard,
    termWeighting: record.termWeighting ?? context.termWeighting,
  };
}

export function emptyProgressStore(): ProgressStore {
  return { version: 1, context: {}, records: {} };
}

function statusOf(value: unknown): LessonStatus {
  if (value === "completed" || value === "in_progress" || value === "not_started") return value;
  return "not_started";
}

function parseAttempt(value: unknown): QuickCheckAttempt | null {
  if (!isRecord(value)) return null;
  const checkId = asString(value.checkId);
  const selected = asString(value.selected);
  const at = asString(value.at);
  if (!checkId || !selected || !at || typeof value.correct !== "boolean") return null;
  return {
    checkId,
    selected,
    at,
    correct: value.correct,
    countsTowardScore: value.countsTowardScore !== false,
  };
}

function parseRecord(value: unknown): LessonProgressRecord | null {
  if (!isRecord(value)) return null;
  const lessonId = asString(value.lessonId);
  const href = asString(value.href);
  const title = asString(value.title);
  const subject = asString(value.subject);
  const topic = asString(value.topic);
  const phase = asString(value.phase);
  const grade = asNumber(value.grade);
  const term = asNumber(value.term);
  const week = asNumber(value.week);
  if (!lessonId || !href || !title || !subject || !topic || !phase || grade === null || term === null || week === null) {
    return null;
  }
  const sectionsVisited = Array.isArray(value.sectionsVisited)
    ? value.sectionsVisited.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const quickCheckAttempts = Array.isArray(value.quickCheckAttempts)
    ? value.quickCheckAttempts.flatMap((item) => {
        const attempt = parseAttempt(item);
        return attempt ? [attempt] : [];
      })
    : [];
  const score = asNumber(value.scorePercent);
  const context = cleanContext(value);
  return {
    lessonId,
    href,
    title,
    subject,
    topic,
    phase,
    grade,
    term,
    week,
    nextHref: asString(value.nextHref),
    nextTitle: asString(value.nextTitle),
    status: statusOf(value.status),
    sectionsVisited: [...new Set(sectionsVisited)].slice(0, 40),
    quickCheckAttempts: quickCheckAttempts.slice(-MAX_ATTEMPTS),
    scorePercent: score === null ? null : Math.max(0, Math.min(100, Math.round(score))),
    lastStudiedAt: asString(value.lastStudiedAt),
    completedAt: asString(value.completedAt),
    ...context,
    termWeighting: context.termWeighting,
  };
}

export function parseProgressStore(value: unknown): ProgressStore {
  if (!isRecord(value)) return emptyProgressStore();
  const records: Record<string, LessonProgressRecord> = {};
  const rawRecords = isRecord(value.records) ? value.records : {};
  for (const [key, record] of Object.entries(rawRecords)) {
    const parsed = parseRecord(record);
    if (!parsed) continue;
    records[parsed.lessonId || key] = parsed;
    if (Object.keys(records).length >= MAX_RECORDS) break;
  }
  return {
    version: 1,
    context: cleanContext(value.context),
    records,
  };
}

function baseRecord(lesson: LessonLocator, context: InstitutionalContext, at: string): LessonProgressRecord {
  return stampContext(
    {
      ...lesson,
      nextHref: lesson.nextHref || null,
      nextTitle: lesson.nextTitle || null,
      status: "not_started",
      sectionsVisited: [],
      quickCheckAttempts: [],
      scorePercent: null,
      lastStudiedAt: at,
      completedAt: null,
    },
    context
  );
}

function scoreFromAttempts(attempts: QuickCheckAttempt[]): number | null {
  const scored = attempts.filter((attempt) => attempt.countsTowardScore);
  if (!scored.length) return null;
  const byCheck = new Map<string, boolean>();
  for (const attempt of scored) {
    byCheck.set(attempt.checkId, (byCheck.get(attempt.checkId) ?? false) || attempt.correct);
  }
  const correct = [...byCheck.values()].filter(Boolean).length;
  return Math.round((correct / byCheck.size) * 100);
}

function touch(record: LessonProgressRecord, at: string): LessonProgressRecord {
  return {
    ...record,
    lastStudiedAt: at,
    status: record.status === "completed" ? "completed" : "in_progress",
  };
}

export function applyProgress(store: ProgressStore, event: ProgressEvent): ProgressStore {
  if (event.type === "set_context") {
    const context = cleanContext(event.context);
    const records: Record<string, LessonProgressRecord> = {};
    for (const [id, record] of Object.entries(store.records)) {
      records[id] = stampContext(record, context);
    }
    return { version: 1, context, records };
  }

  const existing = store.records[event.lesson.lessonId];
  let record = existing
    ? { ...existing, ...event.lesson, nextHref: event.lesson.nextHref ?? existing.nextHref, nextTitle: event.lesson.nextTitle ?? existing.nextTitle }
    : baseRecord(event.lesson, store.context, event.at);
  record = stampContext(record, store.context);

  if (event.type === "visit_section") {
    const sectionId = event.sectionId.trim();
    if (sectionId && !record.sectionsVisited.includes(sectionId)) {
      record = { ...record, sectionsVisited: [...record.sectionsVisited, sectionId].slice(-40) };
    }
    record = touch(record, event.at);
  }

  if (event.type === "quick_check") {
    const attempt: QuickCheckAttempt = {
      checkId: event.checkId,
      correct: event.correct,
      selected: event.selected,
      at: event.at,
      countsTowardScore: event.countsTowardScore,
    };
    const quickCheckAttempts = [...record.quickCheckAttempts, attempt].slice(-MAX_ATTEMPTS);
    record = touch(
      {
        ...record,
        quickCheckAttempts,
        scorePercent: scoreFromAttempts(quickCheckAttempts),
      },
      event.at
    );
  }

  if (event.type === "complete") {
    record = {
      ...touch(record, event.at),
      status: "completed",
      completedAt: record.completedAt || event.at,
    };
  }

  return {
    version: 1,
    context: store.context,
    records: { ...store.records, [record.lessonId]: record },
  };
}

export function lessonStatus(store: ProgressStore, lessonId: string): LessonStatus {
  return store.records[lessonId]?.status ?? "not_started";
}

export type CompletionSlice = {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  percent: number;
};

export function completionFor(store: ProgressStore, lessonIds: string[]): CompletionSlice {
  let completed = 0;
  let inProgress = 0;
  for (const id of lessonIds) {
    const status = lessonStatus(store, id);
    if (status === "completed") completed += 1;
    else if (status === "in_progress") inProgress += 1;
  }
  const total = lessonIds.length;
  const notStarted = Math.max(0, total - completed - inProgress);
  return {
    total,
    completed,
    inProgress,
    notStarted,
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
}

function weightOf(lesson: RollupLesson, record: LessonProgressRecord | undefined) {
  const value = record?.termWeighting ?? lesson.termWeighting;
  return typeof value === "number" && value > 0 ? value : 1;
}

function statFor(key: string, lessons: RollupLesson[], store: ProgressStore): ScopeStat {
  let completed = 0;
  let inProgress = 0;
  let weightTotal = 0;
  let weightDone = 0;
  for (const lesson of lessons) {
    const record = store.records[lesson.id];
    const status = record?.status ?? "not_started";
    const weight = weightOf(lesson, record);
    weightTotal += weight;
    if (status === "completed") {
      completed += 1;
      weightDone += weight;
    } else if (status === "in_progress") {
      inProgress += 1;
    }
  }
  const total = lessons.length;
  return {
    key,
    total,
    completed,
    inProgress,
    notStarted: Math.max(0, total - completed - inProgress),
    percent: total ? Math.round((completed / total) * 100) : 0,
    weightedPercent: weightTotal ? Math.round((weightDone / weightTotal) * 100) : 0,
  };
}

function groupBy(lessons: RollupLesson[], keyFn: (lesson: RollupLesson) => string) {
  const groups = new Map<string, RollupLesson[]>();
  for (const lesson of lessons) {
    const key = keyFn(lesson);
    const list = groups.get(key);
    if (list) list.push(lesson);
    else groups.set(key, [lesson]);
  }
  return groups;
}

export function rollupCompletion(store: ProgressStore, lessons: RollupLesson[]) {
  return {
    overall: statFor("overall", lessons, store),
    bySubject: [...groupBy(lessons, (lesson) => lesson.subject).entries()].map(([key, group]) =>
      statFor(key, group, store)
    ),
    byGrade: [...groupBy(lessons, (lesson) => String(lesson.grade)).entries()].map(([key, group]) =>
      statFor(key, group, store)
    ),
    byTerm: [...groupBy(lessons, (lesson) => `${lesson.grade}:${lesson.subject}:${lesson.term}`).entries()].map(
      ([key, group]) => statFor(key, group, store)
    ),
  };
}

export type ProgressSummary = {
  schema: "school.learn.progress.summary.v1";
  generatedAt: string;
  context: InstitutionalContext;
  overall: ScopeStat;
  bySubject: ScopeStat[];
  byGrade: ScopeStat[];
  byTerm: ScopeStat[];
  lessons: Array<{
    lessonId: string;
    title: string;
    subject: string;
    grade: number;
    phase: string;
    term: number;
    week: number;
    topic: string;
    status: LessonStatus;
    scorePercent: number | null;
    sectionsVisited: number;
    quickCheckAttempts: number;
    lastStudiedAt: string | null;
    completedAt: string | null;
    institutionId?: string;
    classId?: string;
    cohortId?: string;
    curriculumStandard?: string;
    termWeighting?: number;
  }>;
};

export function exportProgressSummary(
  store: ProgressStore,
  lessons: RollupLesson[],
  generatedAt: string
): ProgressSummary {
  const rollup = rollupCompletion(store, lessons);
  const known = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const rows = Object.values(store.records)
    .filter((record) => known.size === 0 || known.has(record.lessonId))
    .map((record) => ({
      lessonId: record.lessonId,
      title: record.title,
      subject: record.subject,
      grade: record.grade,
      phase: record.phase,
      term: record.term,
      week: record.week,
      topic: record.topic,
      status: record.status,
      scorePercent: record.scorePercent,
      sectionsVisited: record.sectionsVisited.length,
      quickCheckAttempts: record.quickCheckAttempts.length,
      lastStudiedAt: record.lastStudiedAt,
      completedAt: record.completedAt,
      institutionId: record.institutionId,
      classId: record.classId,
      cohortId: record.cohortId,
      curriculumStandard: record.curriculumStandard,
      termWeighting: record.termWeighting,
    }));

  return {
    schema: "school.learn.progress.summary.v1",
    generatedAt,
    context: store.context,
    overall: rollup.overall,
    bySubject: rollup.bySubject,
    byGrade: rollup.byGrade,
    byTerm: rollup.byTerm,
    lessons: rows,
  };
}

function timeOf(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mergeProgressStores(left: ProgressStore, right: ProgressStore): ProgressStore {
  const records: Record<string, LessonProgressRecord> = { ...left.records };
  for (const [id, incoming] of Object.entries(right.records)) {
    const current = records[id];
    if (!current || timeOf(incoming.lastStudiedAt) >= timeOf(current.lastStudiedAt)) {
      records[id] = incoming;
    }
  }
  return {
    version: 1,
    context: { ...left.context, ...cleanContext(right.context) },
    records,
  };
}

export type ContinueTarget = {
  href: string;
  title: string;
  topic: string;
  reason: string;
};

/**
 * One browser can fire a progress save per section. Each save is a full snapshot.
 * This queue keeps only the newest snapshot that has not started uploading, and
 * never starts the next upload until the previous response has returned.
 */
export function createProgressWriteQueue(send: (store: ProgressStore) => Promise<boolean>) {
  let pending: ProgressStore | null = null;
  let chain: Promise<void> = Promise.resolve();

  return function enqueue(store: ProgressStore): Promise<boolean> {
    pending = store;
    const run = chain.then(async () => {
      if (pending !== store) return true;
      const snapshot = pending;
      pending = null;
      return send(snapshot).catch(() => false);
    });
    chain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };
}

export function continueTarget(store: ProgressStore): ContinueTarget | null {
  const records = Object.values(store.records).filter((record) => record.lastStudiedAt);
  if (!records.length) return null;
  const byRecent = [...records].sort((a, b) => timeOf(b.lastStudiedAt) - timeOf(a.lastStudiedAt));
  const current = byRecent.find((record) => record.status === "in_progress") ?? byRecent[0];
  if (!current) return null;
  if (current.status === "completed" && current.nextHref) {
    return {
      href: current.nextHref,
      title: current.nextTitle || "Next lesson",
      topic: current.topic,
      reason: `You finished ${current.title}.`,
    };
  }
  return {
    href: current.href,
    title: current.title,
    topic: current.topic,
    reason: current.status === "completed" ? "Last lesson you finished." : "Pick up where you left off.",
  };
}
