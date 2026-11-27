import "server-only";

import type { CalendarFormat } from "@/lib/academicPeriod";
import type { LessonGenerationPlan } from "@/lib/lessonGenerationPlan";
import type { LessonGenerationJob, LessonGenerationQueueState } from "@/lib/server/lessonGenerationQueue";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export type ExamDateEntry = {
  subject: string;
  date: string;
};

export type AcademicState = {
  selectedSubjects: string[];
  selectedSubjectLabels: string[];
  examDates: ExamDateEntry[];
  studyType: "school" | "university" | null;
  grade: number | null;
  phase: string | null;
  institutionId: string | null;
  institution: string | null;
  campus: string | null;
  yearOfStudy: number | null;
  faculty: string | null;
  course: string | null;
  courseId: string | null;
  courseCode: string | null;
  modulePlan: Array<{
    code: string;
    name: string;
    semester: number | null;
    yearOfStudy: number;
    credits: number | null;
    isCore: boolean | null;
    durationType: "semester" | "year" | null;
    durationLabel: string | null;
    assumed: boolean;
    source: string;
  }>;
  calendarFormat: CalendarFormat | null;
  lessonGenerationPlan: LessonGenerationPlan | null;
  lessonGenerationQueue: LessonGenerationQueueState | null;
};

export type DailyQuizState = {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
};

export type PersonalisationState = {
  studyStyle: "visual" | "text" | "mixed" | null;
  bestStudyTime: "morning" | "afternoon" | "evening" | "night" | null;
  aiPersona: "standard" | "mzansi" | "strict" | null;
  weakestSubjects: string[];
  dailyMood: {
    value: "focused" | "tired" | "stressed" | null;
    updatedAt: string | null;
  };
};

// All 11 text-based South African official languages (SASL is visual — excluded).
export type SaLanguageCode = "en" | "zu" | "xh" | "af" | "st" | "tn" | "nso" | "ts" | "ss" | "ve" | "nr";

export const SA_LANGUAGES: Record<SaLanguageCode, string> = {
  en: "English",
  zu: "isiZulu",
  xh: "isiXhosa",
  af: "Afrikaans",
  st: "Sesotho",
  tn: "Setswana",
  nso: "Sepedi",
  ts: "Xitsonga",
  ss: "siSwati",
  ve: "Tshivenda",
  nr: "isiNdebele",
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function asExamDates(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = asRecord(item);
    const subject = asString(record.subject);
    const date = asString(record.date);
    if (!subject || !date) return [];
    return [{ subject, date }];
  });
}

function asModulePlan(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = asRecord(item);
    const code = asString(record.code);
    const name = asString(record.name);
    const yearOfStudy = asNumber(record.yearOfStudy);
    if (!code || !name || yearOfStudy === null) return [];

    const semesterRaw = asNumber(record.semester);
    const creditsRaw = asNumber(record.credits);
    const assumed = typeof record.assumed === "boolean" ? record.assumed : false;
    const source = asString(record.source) ?? (assumed ? "yearbook" : "manual");
    const durationType: "semester" | "year" | null =
      record.durationType === "semester" || record.durationType === "year"
        ? record.durationType
        : null;
    const durationLabel = asString(record.durationLabel);
    const isCore = typeof record.isCore === "boolean" ? record.isCore : null;

    return [
      {
        code,
        name,
        semester: semesterRaw !== null ? Math.round(semesterRaw) : null,
        yearOfStudy: Math.max(1, Math.round(yearOfStudy)),
        credits: creditsRaw !== null ? Math.max(0, Math.round(creditsRaw)) : null,
        isCore,
        durationType,
        durationLabel,
        assumed,
        source,
      },
    ];
  });
}

function asCalendarFormat(value: unknown): CalendarFormat | null {
  return value === "term" || value === "semester" || value === "trimester" || value === "quarter" ? value : null;
}

function asLessonPlanMetadata(value: unknown) {
  return Object.entries(asRecord(value)).reduce<Record<string, string | number | boolean | null>>((acc, [key, entry]) => {
    if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean" || entry === null) {
      acc[key] = entry;
    }
    return acc;
  }, {});
}

function asLessonGenerationPlan(value: unknown): LessonGenerationPlan | null {
  const record = asRecord(value);
  const studyType = record.studyType === "school" || record.studyType === "university" ? record.studyType : null;
  const summary = asString(record.summary);
  const storageRoot = asString(record.storageRoot);
  const targets = Array.isArray(record.targets)
    ? record.targets.flatMap((item) => {
      const target = asRecord(item);
      const id = asString(target.id);
      const label = asString(target.label);
      const queueKey = asString(target.queueKey);
      const targetType: "subject" | "module" | null =
        target.targetType === "subject" || target.targetType === "module" ? target.targetType : null;
      const storagePath = asString(target.storagePath);
      const storagePattern = asString(target.storagePattern);
      const metadata = asLessonPlanMetadata(target.metadata);
      if (!id || !label || !queueKey || !targetType || !storagePath) return [];
      return [{ id, label, queueKey, targetType, storagePath, storagePattern: storagePattern ?? undefined, metadata }];
      })
    : [];

  if (!studyType || !summary || !storageRoot) return null;
  return { studyType, summary, storageRoot, targets };
}

function asLessonGenerationJobStatus(value: unknown): LessonGenerationJob["status"] | null {
  return value === "queued" || value === "processing" || value === "completed" || value === "failed" ? value : null;
}

function asLessonGenerationQueue(value: unknown): LessonGenerationQueueState | null {
  const record = asRecord(value);
  const version = asNumber(record.version);
  const planSummary = asString(record.planSummary);
  const storageRoot = asString(record.storageRoot);
  if (version !== 1 || !planSummary || !storageRoot || !Array.isArray(record.jobs)) return null;

  const jobs = record.jobs.flatMap((item) => {
    const job = asRecord(item);
    const id = asString(job.id);
    const queueKey = asString(job.queueKey);
    const planStudyType = job.planStudyType === "school" || job.planStudyType === "university" ? job.planStudyType : null;
    const targetId = asString(job.targetId);
    const targetType: "subject" | "module" | null =
      job.targetType === "subject" || job.targetType === "module" ? job.targetType : null;
    const label = asString(job.label);
    const storagePath = asString(job.storagePath);
    const storagePattern = asString(job.storagePattern);
    const status = asLessonGenerationJobStatus(job.status);
    const attempts = asNumber(job.attempts);
    const error = asString(job.error);
    const createdAt = asString(job.createdAt);
    const updatedAt = asString(job.updatedAt);
    const startedAt = asString(job.startedAt);
    const completedAt = asString(job.completedAt);
    const failedAt = asString(job.failedAt);
    const metadata = asLessonPlanMetadata(job.metadata);
    if (
      !id ||
      !queueKey ||
      !planStudyType ||
      !targetId ||
      !targetType ||
      !label ||
      !storagePath ||
      !status ||
      attempts === null ||
      !createdAt ||
      !updatedAt
    ) {
      return [];
    }

    return [
      {
        id,
        queueKey,
        planStudyType,
        targetId,
        targetType,
        label,
        storagePath,
        storagePattern: storagePattern ?? undefined,
        status,
        attempts: Math.max(0, Math.round(attempts)),
        error,
        metadata,
        createdAt,
        updatedAt,
        startedAt,
        completedAt,
        failedAt,
      } satisfies LessonGenerationJob,
    ];
  });

  return {
    version: 1,
    planSummary,
    storageRoot,
    jobs,
  };
}

function mergeKnownPreferenceBranches(existing: Record<string, unknown>, patch: Record<string, unknown>) {
  const merged: Record<string, unknown> = {
    ...existing,
    ...patch,
  };

  for (const branch of ["academics", "dailyQuiz", "profileSettings", "notifications", "onboarding", "personalisation", "learnProgress"]) {
    if (branch in patch) {
      merged[branch] = {
        ...asRecord(existing[branch]),
        ...asRecord(patch[branch]),
      };
    }
  }

  return merged;
}

export async function getUserAppPreferences(userId: string) {
  const result = await queryPlannerDb<{ app_preferences: Record<string, unknown> }>(
    `
      SELECT app_preferences
      FROM user_profiles
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  );

  return asRecord(result.rows[0]?.app_preferences);
}

export async function patchUserAppPreferences(userId: string, patch: Record<string, unknown>) {
  const current = await getUserAppPreferences(userId);
  const next = mergeKnownPreferenceBranches(current, patch);

  await queryPlannerDb(
    `
      INSERT INTO user_profiles (user_id, app_preferences)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (user_id) DO UPDATE
      SET app_preferences = $2::jsonb,
          updated_at = NOW()
    `,
    [userId, JSON.stringify(next)]
  );

  return next;
}

export function readAcademicState(preferences: Record<string, unknown>): AcademicState {
  const academics = asRecord(preferences.academics);
  const grade = asNumber(academics.grade);
  const yearOfStudy = asNumber(academics.yearOfStudy);

  return {
    selectedSubjects: asStringArray(academics.selectedSubjects),
    selectedSubjectLabels: asStringArray(academics.selectedSubjectLabels),
    examDates: asExamDates(academics.examDates),
    studyType:
      academics.studyType === "school" || academics.studyType === "university"
        ? academics.studyType
        : null,
    grade: grade !== null ? Math.round(grade) : null,
    phase: asString(academics.phase),
    institutionId: asString(academics.institutionId),
    institution: asString(academics.institution),
    campus: asString(academics.campus),
    yearOfStudy: yearOfStudy !== null ? Math.round(yearOfStudy) : null,
    faculty: asString(academics.faculty),
    course: asString(academics.course),
    courseId: asString(academics.courseId),
    courseCode: asString(academics.courseCode),
    modulePlan: asModulePlan(academics.modulePlan),
    calendarFormat: asCalendarFormat(academics.calendarFormat),
    lessonGenerationPlan: asLessonGenerationPlan(academics.lessonGenerationPlan),
    lessonGenerationQueue: asLessonGenerationQueue(academics.lessonGenerationQueue),
  };
}

export function readDailyQuizState(preferences: Record<string, unknown>): DailyQuizState {
  const dailyQuiz = asRecord(preferences.dailyQuiz);
  const currentStreak = asNumber(dailyQuiz.currentStreak);
  const longestStreak = asNumber(dailyQuiz.longestStreak);

  return {
    currentStreak: currentStreak !== null ? Math.max(0, Math.round(currentStreak)) : 0,
    longestStreak: longestStreak !== null ? Math.max(0, Math.round(longestStreak)) : 0,
    lastActiveDate: asString(dailyQuiz.lastActiveDate),
  };
}

export function readPersonalisationState(preferences: Record<string, unknown>): PersonalisationState {
  const personalisation = asRecord(preferences.personalisation);
  const dailyMood = asRecord(personalisation.dailyMood);

  return {
    studyStyle: (personalisation.studyStyle as any) ?? null,
    bestStudyTime: (personalisation.bestStudyTime as any) ?? null,
    aiPersona: (personalisation.aiPersona as any) ?? null,
    weakestSubjects: asStringArray(personalisation.weakestSubjects),
    dailyMood: {
      value: (dailyMood.value as any) ?? null,
      updatedAt: asString(dailyMood.updatedAt),
    },
  };
}

export function readLanguagePreference(preferences: Record<string, unknown>): SaLanguageCode {
  const lang = asString(preferences.language);
  if (lang && lang in SA_LANGUAGES) return lang as SaLanguageCode;
  return "en";
}
