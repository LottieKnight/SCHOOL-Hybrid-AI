const LESSON_KEY_PATTERN = /^(\d{2})-([a-z0-9-]+)-(\d{2})-(\d{2})$/i;

export type ParsedLessonKey = {
  grade: number;
  subjectKey: string;
  term: number;
  week: number;
};

export function derivePhaseFromGrade(grade: number) {
  if (!Number.isFinite(grade)) return null;
  if (grade <= 3) return "foundation";
  if (grade <= 6) return "intermediate";
  if (grade <= 9) return "senior";
  return "fet";
}

function formatGradeSlugFromNumber(grade: number) {
  if (grade === 0) return "grade-00";
  return `grade-${String(grade).padStart(2, "0")}`;
}

export function parseLessonKey(lessonKey: string): ParsedLessonKey | null {
  const match = lessonKey.match(LESSON_KEY_PATTERN);
  if (!match) return null;
  const grade = Number(match[1]);
  const term = Number(match[3]);
  const week = Number(match[4]);
  if (!Number.isFinite(grade) || !Number.isFinite(term) || !Number.isFinite(week)) return null;
  return {
    grade,
    subjectKey: match[2].toLowerCase(),
    term,
    week,
  };
}

export function buildLearnWeekHrefFromLessonKey(lessonKey: string): string | null {
  const parsed = parseLessonKey(lessonKey);
  if (!parsed) return null;
  const phase = derivePhaseFromGrade(parsed.grade);
  if (!phase) return null;
  if (parsed.term < 1 || parsed.term > 4 || parsed.week < 1 || parsed.week > 20) return null;
  const gradeSlug = formatGradeSlugFromNumber(parsed.grade);
  return `/learn/${phase}/${gradeSlug}/${encodeURIComponent(parsed.subjectKey)}/term/${parsed.term}/week/${parsed.week}`;
}
