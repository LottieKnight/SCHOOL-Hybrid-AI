export const VALID_PHASES = new Set(["foundation", "intermediate", "senior", "fet"]);
export const SCHOOL_LESSON_STORAGE_ROOT = "content/lessons";
export const UNIVERSITY_LESSON_STORAGE_ROOT = "content/university-lessons";

export type LessonRouteParams = {
  phase: string;
  grade: string | number;
  subject: string;
  term: string | number;
  week: string | number;
};

type ParsedLessonParams = {
  phase: string;
  grade: number;
  term: number;
  week: number;
  subject: string;
};

function toNumber(value: string | number) {
  if (typeof value === "number") return value;
  const trimmed = value.trim();
  if (trimmed.toLowerCase() === "r") return 0;
  const match = trimmed.match(/\d+/);
  if (!match) return NaN;
  const num = Number.parseInt(match[0], 10);
  return Number.isFinite(num) ? num : NaN;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function slugifyLessonSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function formatLessonGradeSegment(grade: string | number) {
  return pad2(toNumber(grade));
}

export function buildSchoolLessonStoragePattern(params: { grade: string | number; subject: string }) {
  const gradeSegment = formatLessonGradeSegment(params.grade);
  const subjectSegment = slugifyLessonSegment(params.subject);
  return `${SCHOOL_LESSON_STORAGE_ROOT}/grade-${gradeSegment}/${subjectSegment}/term-{term}/week-{week}.json`;
}

export function buildUniversityLessonStorageBasePath(params: {
  institution: string;
  faculty: string;
  course: string;
  yearOfStudy: string | number;
}) {
  const institutionSegment = slugifyLessonSegment(params.institution);
  const facultySegment = slugifyLessonSegment(params.faculty);
  const courseSegment = slugifyLessonSegment(params.course);
  const yearSegment = pad2(Math.max(1, toNumber(params.yearOfStudy)));
  return `${UNIVERSITY_LESSON_STORAGE_ROOT}/${institutionSegment}/${facultySegment}/${courseSegment}/year-${yearSegment}`;
}

export function buildUniversityModuleLessonStoragePath(
  context: {
    institution: string;
    faculty: string;
    course: string;
    yearOfStudy: string | number;
  },
  moduleCode: string,
) {
  return `${buildUniversityLessonStorageBasePath(context)}/${slugifyLessonSegment(moduleCode)}/lesson.json`;
}

export function validateLessonParams(params: LessonRouteParams) {
  const phase = params.phase;
  const grade = toNumber(params.grade);
  const term = toNumber(params.term);
  const week = toNumber(params.week);

  if (!VALID_PHASES.has(phase)) return { valid: false, reason: "Invalid phase" };
  if (!Number.isFinite(grade) || grade < 0 || grade > 12) return { valid: false, reason: "Invalid grade" };
  if (!Number.isFinite(term) || term < 1 || term > 4) return { valid: false, reason: "Invalid term" };
  if (!Number.isFinite(week) || week < 1) return { valid: false, reason: "Invalid week" };
  if (!params.subject || params.subject.trim().length < 1) return { valid: false, reason: "Invalid subject" };
  return { valid: true };
}

export function normalizeLessonParams(params: LessonRouteParams): ParsedLessonParams | null {
  const validation = validateLessonParams(params);
  if (!validation.valid) return null;
  return {
    phase: params.phase,
    grade: toNumber(params.grade),
    term: toNumber(params.term),
    week: toNumber(params.week),
    subject: params.subject.trim(),
  };
}

export function buildLessonHref(params: LessonRouteParams) {
  const normalized = normalizeLessonParams(params);
  if (!normalized) return "#";
  return `/phase/${normalized.phase}/grade/${formatLessonGradeSegment(normalized.grade)}/${normalized.subject}/term/${pad2(
    normalized.term
  )}/week/${pad2(normalized.week)}`;
}
