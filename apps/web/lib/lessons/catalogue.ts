import { buildLessonId, type CurriculumCode } from "./schema";

export type CatalogueEntry = {
  id: string;
  href: string;
  phase: string;
  grade: number;
  gradeSlug: string;
  subjectKey: string;
  subjectName: string;
  term: number;
  week: number;
  topic: string;
  curriculum: CurriculumCode;
};

export type CatalogueQuery = {
  curriculum?: CurriculumCode;
  phase?: string;
  grade?: number;
  subject?: string;
  term?: number;
  topic?: string;
};

export type TermPlan = {
  term: number;
  weeks: number;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function filterCatalogue(entries: CatalogueEntry[], query: CatalogueQuery = {}): CatalogueEntry[] {
  const subject = query.subject ? normalize(query.subject) : "";
  const topic = query.topic ? normalize(query.topic) : "";
  const phase = query.phase ? normalize(query.phase) : "";

  return entries.filter((entry) => {
    if (query.curriculum && entry.curriculum !== query.curriculum) return false;
    if (phase && normalize(entry.phase) !== phase) return false;
    if (typeof query.grade === "number" && entry.grade !== query.grade) return false;
    if (typeof query.term === "number" && entry.term !== query.term) return false;
    if (subject) {
      const haystack = `${entry.subjectKey} ${entry.subjectName}`.toLowerCase();
      if (!haystack.includes(subject)) return false;
    }
    if (topic && !entry.topic.toLowerCase().includes(topic)) return false;
    return true;
  });
}

export function nextCatalogueEntry(entries: CatalogueEntry[], currentId: string): CatalogueEntry | null {
  const index = entries.findIndex((entry) => entry.id === currentId);
  if (index < 0) return null;
  return entries[index + 1] ?? null;
}

export function parseGradeSlug(grade: string): number | null {
  const lower = grade.trim().toLowerCase();
  if (!lower) return null;
  if (lower === "r") return 0;
  if (lower.startsWith("grade-")) {
    const raw = lower.slice("grade-".length);
    if (raw === "r" || raw === "0" || raw === "00") return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(lower);
  return Number.isFinite(parsed) ? parsed : null;
}

export function termPlansFromTerms(terms: Record<string, { weeks?: unknown[] } | undefined> | null | undefined): TermPlan[] {
  const source = terms ?? {};
  const numbers = Object.keys(source)
    .map((key) => Number(key.replace(/\D/g, "")))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  const termNumbers = numbers.length ? numbers : [1, 2, 3, 4];
  return termNumbers.map((term) => {
    const key = Object.keys(source).find((candidate) => Number(candidate.replace(/\D/g, "")) === term);
    const weeks = key && Array.isArray(source[key]?.weeks) ? source[key]!.weeks!.length : 10;
    return { term, weeks: weeks || 10 };
  });
}

export function buildLearnCatalogue(input: {
  phases: Array<{
    key: string;
    grades: Array<{
      grade: number;
      slug: string;
      subjects: Array<{
        key: string;
        name: string;
        terms: Array<{ term: number; weeks: Array<{ week: number; topic: string }> }>;
      }>;
    }>;
  }>;
  curriculum?: CurriculumCode;
}): CatalogueEntry[] {
  const curriculum = input.curriculum ?? "CAPS";
  const entries: CatalogueEntry[] = [];
  for (const phase of input.phases) {
    for (const grade of phase.grades) {
      for (const subject of grade.subjects) {
        for (const term of subject.terms) {
          for (const week of term.weeks) {
            const id = buildLessonId({
              phase: phase.key,
              grade: grade.grade,
              subjectKey: subject.key,
              term: term.term,
              week: week.week,
            });
            entries.push({
              id,
              href: `/learn/${phase.key}/${grade.slug}/${subject.key}/term/${term.term}/week/${week.week}`,
              phase: phase.key,
              grade: grade.grade,
              gradeSlug: grade.slug,
              subjectKey: subject.key,
              subjectName: subject.name,
              term: term.term,
              week: week.week,
              topic: week.topic,
              curriculum,
            });
          }
        }
      }
    }
  }
  return entries;
}
