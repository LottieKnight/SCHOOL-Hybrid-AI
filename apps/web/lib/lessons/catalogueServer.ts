import {
  findLearnSubject,
  formatGradeSlug,
  getLearnGrades,
  getLearnPhases,
  getLearnSubjects,
  getTermInfo,
  parseGradeParam,
} from "@/lib/learnV2";
import { buildLearnCatalogue, type CatalogueEntry } from "./catalogue";
import { buildLessonId } from "./schema";

function topicOf(week: { topic_title?: string } | undefined, index: number) {
  const title = week?.topic_title?.trim();
  return title || `Week ${index} overview`;
}

export function buildCapsCatalogue(): CatalogueEntry[] {
  const phases = getLearnPhases().map((phase) => ({
    key: phase.key,
    grades: getLearnGrades(phase.key).flatMap((grade) => {
      const gradeNumber = parseGradeParam(grade.slug);
      if (gradeNumber === null) return [];
      return [
        {
          grade: gradeNumber,
          slug: grade.slug || formatGradeSlug(grade.key),
          subjects: getLearnSubjects(phase.key, grade.slug).map((subject) => {
            const terms = subject.terms || {};
            const termNumbers = Object.keys(terms)
              .map((key) => Number(key.replace(/\D/g, "")))
              .filter((value) => Number.isFinite(value))
              .sort((a, b) => a - b);
            const resolved = termNumbers.length ? termNumbers : [1, 2, 3, 4];
            return {
              key: subject.key,
              name: subject.name,
              terms: resolved.map((termNumber) => {
                const { term } = getTermInfo(terms, termNumber);
                const weeks = term?.weeks?.length
                  ? term.weeks
                  : Array.from({ length: 10 }, (_, index) => ({ topic_title: `Week ${index + 1} overview` }));
                return {
                  term: termNumber,
                  weeks: weeks.map((week, index) => ({
                    week: index + 1,
                    topic: topicOf(week, index + 1),
                  })),
                };
              }),
            };
          }),
        },
      ];
    }),
  }));

  return buildLearnCatalogue({ phases, curriculum: "CAPS" });
}

export function lookupCatalogueLesson(input: {
  phase: string;
  grade: string;
  subject: string;
  term: number;
  week: number;
}): CatalogueEntry | null {
  const subjectEntry = findLearnSubject(input.phase, input.grade, input.subject);
  const gradeNumber = parseGradeParam(input.grade);
  if (!subjectEntry || gradeNumber === null) return null;
  const { term } = getTermInfo(subjectEntry.terms || {}, input.term);
  const weekEntry = term?.weeks?.[input.week - 1];
  return {
    id: buildLessonId({
      phase: input.phase,
      grade: gradeNumber,
      subjectKey: subjectEntry.key,
      term: input.term,
      week: input.week,
    }),
    href: `/learn/${input.phase}/${input.grade}/${subjectEntry.key}/term/${input.term}/week/${input.week}`,
    phase: input.phase,
    grade: gradeNumber,
    gradeSlug: input.grade,
    subjectKey: subjectEntry.key,
    subjectName: subjectEntry.name,
    term: input.term,
    week: input.week,
    topic: topicOf(weekEntry, input.week),
    curriculum: "CAPS",
  };
}
