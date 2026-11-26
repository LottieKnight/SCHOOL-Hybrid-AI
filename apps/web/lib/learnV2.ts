import { buildCapsScaffoldFromData, type CapsScaffold, type CapsScaffoldSubject, type CapsScaffoldTerm } from "@saedu/shared";
import courseOutlineJson from "@saedu/shared/content/course_outline.json";

let _scaffold: CapsScaffold | null = null;
function loadCapsScaffold(): CapsScaffold {
  if (!_scaffold) _scaffold = buildCapsScaffoldFromData(courseOutlineJson);
  return _scaffold;
}

export type LearnSubject = {
  key: string;
  name: string;
  terms: Record<string, CapsScaffoldTerm>;
};

export type LearnSubjectGroupCategory = "core" | "elective" | "general";

export type LearnSubjectGroup = {
  key: string;
  name: string;
  subjects: LearnSubject[];
  category: LearnSubjectGroupCategory;
};

export type LearnGrade = {
  key: string;
  name: string;
  slug: string;
};

type SubjectEntry = {
  key: string;
  name: string;
  terms: Record<string, CapsScaffoldTerm>;
};

function defaultTerms(): Record<string, CapsScaffoldTerm> {
  const terms: Record<string, CapsScaffoldTerm> = {};
  for (let term = 1; term <= 4; term += 1) {
    terms[`term${term}`] = {
      name: `Term ${term}`,
      weeks: Array.from({ length: 10 }, (_, idx) => ({
        name: `Week ${idx + 1}`,
        topic_title: `Week ${idx + 1} overview`,
      })),
    };
  }
  return terms;
}

function subjectEntries(subjectKey: string, subject: CapsScaffoldSubject, prefix?: string): SubjectEntry[] {
  const name = prefix ? `${prefix} · ${subject.name}` : subject.name;
  const entries: SubjectEntry[] = [];
  const hasChildren = subject.children && Object.keys(subject.children).length > 0;
  const hasTerms = subject.terms && Object.keys(subject.terms).length > 0;

  if (hasTerms) {
    entries.push({
      key: subjectKey,
      name,
      terms: subject.terms ?? defaultTerms(),
    });
  }

  if (hasChildren) {
    for (const [childKey, child] of Object.entries(subject.children ?? {})) {
      entries.push(...subjectEntries(`${subjectKey}__${childKey}`, child, name));
    }
  }

  if (!hasTerms && !hasChildren) {
    entries.push({
      key: subjectKey,
      name,
      terms: defaultTerms(),
    });
  }

  return entries;
}

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function sortSubjects(entries: SubjectEntry[]) {
  return [...entries].sort((a, b) => naturalCompare(a.name, b.name));
}

function isCoreGroup(groupKey: string, groupName: string) {
  const value = `${groupKey} ${groupName}`.toLowerCase();
  return (
    value.includes("language") ||
    value.includes("mathemat") ||
    value.includes("life orientation")
  );
}

function isElectiveGrade(phaseKey: string, gradeKey: string) {
  if (phaseKey !== "fet") return false;
  const gradeNumber = parseGradeParam(gradeKey);
  return gradeNumber !== null && gradeNumber >= 10;
}

function inferGroupCategory(
  phaseKey: string,
  gradeKey: string,
  groupKey: string,
  groupName: string
): LearnSubjectGroupCategory {
  if (isElectiveGrade(phaseKey, gradeKey)) {
    return isCoreGroup(groupKey, groupName) ? "core" : "elective";
  }
  return "general";
}

function groupOrderScore(groupKey: string, groupName: string) {
  const value = `${groupKey} ${groupName}`.toLowerCase();
  if (value.includes("language")) return 10;
  if (value.includes("mathemat")) return 20;
  if (value.includes("life orientation")) return 30;
  if (value.includes("science")) return 40;
  if (value.includes("social")) return 50;
  if (value.includes("commerce") || value.includes("economic")) return 60;
  if (value.includes("technology")) return 70;
  if (value.includes("art")) return 80;
  return 100;
}

export function getLearnPhases() {
  const scaffold = loadCapsScaffold();
  return Object.entries(scaffold.phases).map(([key, value]) => ({
    key,
    name: value.name,
  }));
}

export function getLearnGrades(phaseKey: string): LearnGrade[] {
  const scaffold = loadCapsScaffold();
  const phase = scaffold.phases[phaseKey];
  if (!phase) return [];
  return Object.entries(phase.grades).map(([key, value]) => ({
    key,
    name: value.name,
    slug: formatGradeSlug(key),
  }));
}

export function getLearnSubjectGroups(phaseKey: string, gradeKey: string): LearnSubjectGroup[] {
  const scaffold = loadCapsScaffold();
  const normalizedGrade = normalizeGradeKey(gradeKey);
  const grade = scaffold.phases[phaseKey]?.grades[normalizedGrade];
  if (!grade) return [];

  const groups: LearnSubjectGroup[] = Object.entries(grade.groups ?? {})
    .map(([groupKey, group]) => {
      const entries: SubjectEntry[] = [];
      for (const [subjectKey, subject] of Object.entries(group.subjects ?? {})) {
        entries.push(...subjectEntries(subjectKey, subject));
      }

      const seen = new Set<string>();
      const subjects = sortSubjects(entries).filter((entry) => {
        if (seen.has(entry.key)) return false;
        seen.add(entry.key);
        return true;
      });

      return {
        key: groupKey,
        name: group.name || groupKey,
        subjects,
        category: inferGroupCategory(phaseKey, gradeKey, groupKey, group.name || groupKey),
      };
    })
    .filter((group) => group.subjects.length > 0);

  return groups.sort((a, b) => {
    const categoryRank = (category: LearnSubjectGroupCategory) =>
      category === "core" ? 0 : category === "elective" ? 1 : 2;

    const categoryDelta = categoryRank(a.category) - categoryRank(b.category);
    if (categoryDelta !== 0) return categoryDelta;

    const orderDelta = groupOrderScore(a.key, a.name) - groupOrderScore(b.key, b.name);
    if (orderDelta !== 0) return orderDelta;

    return naturalCompare(a.name, b.name);
  });
}

export function getLearnSubjects(phaseKey: string, gradeKey: string) {
  const entries = getLearnSubjectGroups(phaseKey, gradeKey).flatMap((group) => group.subjects);
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.key)) return false;
    seen.add(entry.key);
    return true;
  });
}

export function findLearnSubject(phaseKey: string, gradeKey: string, subjectKey: string) {
  return getLearnSubjects(phaseKey, gradeKey).find((subject) => subject.key === subjectKey) || null;
}

export function getTermInfo(terms: Record<string, CapsScaffoldTerm>, termNumber: number) {
  const termKey = Object.keys(terms).find((key) => Number(key.replace(/\D/g, "")) === termNumber);
  const term = termKey ? terms[termKey] : null;
  return { termKey, term };
}

export function formatTermLabel(termNumber: number, fallback?: string) {
  return fallback || `Term ${termNumber}`;
}

export function normalizeGradeKey(gradeKey: string) {
  const lower = gradeKey.toLowerCase();
  if (lower.startsWith("grade-")) {
    const raw = lower.replace("grade-", "");
    if (raw === "00" || raw === "0") return "R";
    const stripped = raw.replace(/^0+/, "");
    return stripped || "R";
  }
  if (lower === "r") return "R";
  return lower;
}

export function formatGradeSlug(gradeKey: string) {
  const normalized = normalizeGradeKey(gradeKey);
  if (normalized === "R" || normalized === "r") return "grade-00";
  const num = Number(normalized);
  if (!Number.isFinite(num)) return `grade-${normalized}`;
  return `grade-${String(num).padStart(2, "0")}`;
}

export function parseGradeParam(gradeParam: string) {
  const normalized = normalizeGradeKey(gradeParam);
  if (normalized === "R" || normalized === "r") return 0;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}
