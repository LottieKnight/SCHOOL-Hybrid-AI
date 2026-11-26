import { unstable_cache } from "next/cache";
import { getPastPaperGrades, getPastPaperProvinces, getPastPaperSubjects } from "@/lib/pastPapers/catalog";

type PastPaperSuggestionInput = {
  classId?: string;
  grade: number;
  subjectKey: string;
  subjectName: string;
};

export type PastPaperSuggestion = {
  href: string;
  fallback: boolean;
  note: string | null;
  matchedProvince: string | null;
  matchedSubject: string | null;
};

const DEFAULT_CLASS_ID = "demo-class";
type ProvinceItem = Awaited<ReturnType<typeof getPastPaperProvinces>>[number];
type GradeItem = Awaited<ReturnType<typeof getPastPaperGrades>>[number];
type SubjectItem = Awaited<ReturnType<typeof getPastPaperSubjects>>[number];

function normalizeToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function buildSubjectNeedles(subjectKey: string, subjectName: string) {
  const set = new Set<string>();
  const add = (value: string) => {
    const normalized = normalizeToken(value);
    if (normalized.length >= 3) {
      set.add(normalized);
    }
  };

  add(subjectKey.replace(/__/g, " "));
  add(subjectName);

  for (const keyPart of subjectKey.split(/__|-/g)) add(keyPart);
  for (const namePart of subjectName.split(/[·/,()-]+/g)) add(namePart);

  return Array.from(set);
}

function pickMatchingSubject(subjects: string[], needles: string[]) {
  for (const subject of subjects) {
    const normalizedSubject = normalizeToken(subject);
    if (!normalizedSubject) continue;
    for (const needle of needles) {
      if (
        normalizedSubject === needle ||
        normalizedSubject.includes(needle) ||
        needle.includes(normalizedSubject)
      ) {
        return subject;
      }
    }
  }
  return null;
}

const resolveSuggestionMatch = unstable_cache(
  async (grade: number, subjectKey: string, subjectName: string) => {
    const needles = buildSubjectNeedles(subjectKey, subjectName);
    const provinces = await getPastPaperProvinces();

    for (const provinceEntry of provinces as ProvinceItem[]) {
      const province = provinceEntry.province;
      const grades = await getPastPaperGrades(province);
      const gradeMatch = grades.some((entry: GradeItem) => entry.grade === grade);
      if (!gradeMatch) continue;

      const subjects = await getPastPaperSubjects(province, grade);
      const matchedSubject = pickMatchingSubject(
        subjects.map((entry: SubjectItem) => entry.subject),
        needles
      );

      if (!matchedSubject) continue;

      return {
        fallback: false,
        note: null,
        matchedProvince: province,
        matchedSubject,
      };
    }

    return {
      fallback: true,
      note: "No direct subject mapping found yet. Browse past papers to pick province and subject.",
      matchedProvince: null,
      matchedSubject: null,
    };
  },
  ["learn-past-paper-suggestion"],
  { revalidate: 60 * 30 }
);

export async function resolveLearnPastPaperSuggestion(
  input: PastPaperSuggestionInput
): Promise<PastPaperSuggestion> {
  const classId = input.classId || DEFAULT_CLASS_ID;
  const fallbackHref = `/classes/${encodeURIComponent(classId)}/past-papers`;
  const match = await resolveSuggestionMatch(input.grade, input.subjectKey, input.subjectName);

  if (!match.fallback && match.matchedProvince && match.matchedSubject) {
    return {
      href:
        `/classes/${encodeURIComponent(classId)}/past-papers/` +
        `${encodeURIComponent(match.matchedProvince)}/${input.grade}/${encodeURIComponent(match.matchedSubject)}`,
      fallback: false,
      note: null,
      matchedProvince: match.matchedProvince,
      matchedSubject: match.matchedSubject,
    };
  }

  return {
    href: fallbackHref,
    fallback: true,
    note: match.note,
    matchedProvince: null,
    matchedSubject: null,
  };
}
