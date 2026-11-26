import type { CapsScaffold, CapsScaffoldSubject, CapsScaffoldTerm, CapsScaffoldWeek } from "@saedu/shared";

export type PlannerWeek = {
  weekNumber: number;
  name: string;
  topicTitle: string;
  summaryMd: string;
};

export type PlannerTerm = {
  termNumber: number;
  name: string;
  weeks: PlannerWeek[];
};

export type PlannerSubject = {
  key: string;
  name: string;
  groupKey: string;
  groupName: string;
  terms: PlannerTerm[];
};

export type PlannerGroupCategory = "core" | "elective" | "general";

export type PlannerGroup = {
  key: string;
  name: string;
  category: PlannerGroupCategory;
  subjects: PlannerSubject[];
};

export type PlannerGradeBand = "Foundation" | "Intermediate" | "Senior" | "FET";

export type PlannerGrade = {
  key: string;
  slug: string;
  number: number;
  name: string;
  phaseKey: string;
  phaseName: string;
  band: PlannerGradeBand;
  groups: PlannerGroup[];
};

export type PlannerCatalog = {
  grades: PlannerGrade[];
};

type SubjectEntry = {
  key: string;
  name: string;
  terms: PlannerTerm[];
};

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function normalizeGradeKey(gradeKey: string) {
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

function formatGradeSlug(gradeKey: string) {
  const normalized = normalizeGradeKey(gradeKey);
  if (normalized === "R") return "grade-00";
  const number = Number(normalized);
  if (!Number.isFinite(number)) return `grade-${normalized}`;
  return `grade-${String(number).padStart(2, "0")}`;
}

export function parseGradeNumber(gradeKey: string) {
  const normalized = normalizeGradeKey(gradeKey);
  if (normalized === "R") return 0;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

export function inferPlannerBand(gradeNumber: number): PlannerGradeBand {
  if (gradeNumber <= 3) return "Foundation";
  if (gradeNumber <= 6) return "Intermediate";
  if (gradeNumber <= 9) return "Senior";
  return "FET";
}

export function inferPlannerPhaseKey(gradeNumber: number) {
  if (gradeNumber <= 3) return "foundation";
  if (gradeNumber <= 6) return "intermediate";
  if (gradeNumber <= 9) return "senior";
  return "fet";
}

function mapWeeks(weeks: CapsScaffoldWeek[] | undefined): PlannerWeek[] {
  return (weeks ?? []).map((week, index) => ({
    weekNumber: index + 1,
    name: week.name || `Week ${index + 1}`,
    topicTitle: week.topic_title || "Topic not yet available",
    summaryMd: week.summary_md || "",
  }));
}

function mapTerms(terms: Record<string, CapsScaffoldTerm> | undefined): PlannerTerm[] {
  return Object.entries(terms ?? {})
    .map(([termKey, term]) => {
      const extractedNumber = Number(termKey.replace(/\D/g, "")) || 0;
      return {
        termNumber: extractedNumber,
        name: term.name || `Term ${extractedNumber || 1}`,
        weeks: mapWeeks(term.weeks),
      };
    })
    .sort((left, right) => left.termNumber - right.termNumber);
}

function collectSubjectEntries(subjectKey: string, subject: CapsScaffoldSubject, prefix?: string): SubjectEntry[] {
  const displayName = prefix ? `${prefix} · ${subject.name}` : subject.name;
  const entries: SubjectEntry[] = [];
  const hasTerms = Boolean(subject.terms && Object.keys(subject.terms).length > 0);
  const hasChildren = Boolean(subject.children && Object.keys(subject.children).length > 0);

  if (hasTerms) {
    entries.push({
      key: subjectKey,
      name: displayName,
      terms: mapTerms(subject.terms),
    });
  }

  if (hasChildren) {
    for (const [childKey, child] of Object.entries(subject.children ?? {})) {
      entries.push(...collectSubjectEntries(`${subjectKey}__${childKey}`, child, displayName));
    }
  }

  if (!hasTerms && !hasChildren) {
    entries.push({
      key: subjectKey,
      name: displayName,
      terms: [],
    });
  }

  return entries;
}

function isCoreGroup(groupKey: string, groupName: string) {
  const value = `${groupKey} ${groupName}`.toLowerCase();
  return value.includes("language") || value.includes("mathemat") || value.includes("life orientation");
}

function inferGroupCategory(gradeNumber: number, groupKey: string, groupName: string): PlannerGroupCategory {
  if (gradeNumber >= 10) {
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

function dedupeSubjects(subjects: SubjectEntry[]) {
  const seen = new Set<string>();
  return subjects
    .sort((left, right) => naturalCompare(left.name, right.name))
    .filter((entry) => {
      if (seen.has(entry.key)) return false;
      seen.add(entry.key);
      return true;
    });
}

export function buildPlannerCatalog(scaffold: CapsScaffold): PlannerCatalog {
  const grades: PlannerGrade[] = [];

  for (const [phaseKey, phase] of Object.entries(scaffold.phases ?? {})) {
    for (const [gradeKey, grade] of Object.entries(phase.grades ?? {})) {
      const gradeNumber = parseGradeNumber(gradeKey);
      const groups: PlannerGroup[] = Object.entries(grade.groups ?? {})
        .map(([groupKey, group]) => {
          const entries = Object.entries(group.subjects ?? {}).flatMap(([subjectKey, subject]) =>
            collectSubjectEntries(subjectKey, subject)
          );
          const subjects = dedupeSubjects(entries).map((entry) => ({
            key: entry.key,
            name: entry.name,
            groupKey,
            groupName: group.name || groupKey,
            terms: entry.terms,
          }));

          return {
            key: groupKey,
            name: group.name || groupKey,
            category: inferGroupCategory(gradeNumber, groupKey, group.name || groupKey),
            subjects,
          };
        })
        .filter((group) => group.subjects.length > 0)
        .sort((left, right) => {
          const categoryRank = (category: PlannerGroupCategory) =>
            category === "core" ? 0 : category === "elective" ? 1 : 2;
          const categoryDelta = categoryRank(left.category) - categoryRank(right.category);
          if (categoryDelta !== 0) return categoryDelta;
          const orderDelta = groupOrderScore(left.key, left.name) - groupOrderScore(right.key, right.name);
          if (orderDelta !== 0) return orderDelta;
          return naturalCompare(left.name, right.name);
        });

      grades.push({
        key: normalizeGradeKey(gradeKey),
        slug: formatGradeSlug(gradeKey),
        number: gradeNumber,
        name: grade.name || `Grade ${gradeKey}`,
        phaseKey,
        phaseName: phase.name || phaseKey,
        band: inferPlannerBand(gradeNumber),
        groups,
      });
    }
  }

  grades.sort((left, right) => left.number - right.number);
  return { grades };
}
