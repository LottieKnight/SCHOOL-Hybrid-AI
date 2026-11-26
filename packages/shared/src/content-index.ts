import { existsSync, promises as fs } from "node:fs";
import path from "node:path";

export type ContentIndexWeek = {
  hasLessonJson: boolean;
  resourcesCount: number;
  resourceTypes: string[];
};

export type ContentIndexStats = {
  total_week_folders: number;
  weeks_with_json: number;
  weeks_with_resources_only: number;
  phases: number;
  grades: number;
  subjects: number;
};

export type ContentIndex = {
  generated_at: string;
  stats: ContentIndexStats;
  phases: Record<
    string,
    {
      grades: Record<
        string,
        {
          subjects: Record<
            string,
            {
              terms: Record<
                string,
                {
                  weeks: Record<string, ContentIndexWeek>;
                }
              >;
            }
          >;
        }
      >;
    }
  >;
};

export type ContentFloorStatus = "green" | "amber" | "red";
export type ContentFloorSubjectSummary = {
  phase: string;
  grade: string;
  subject: string;
  totalWeeks: number;
  weeksWithLessonJson: number;
  weeksWithResources: number;
  lessonCoveragePercent: number;
  resourceCoveragePercent: number;
  status: ContentFloorStatus;
};
export type ContentFloorReport = {
  generated_at: string;
  thresholds: {
    greenLessonCoveragePercent: number;
    amberLessonCoveragePercent: number;
    minimumResourceCoveragePercent: number;
  };
  overall: {
    totalWeeks: number;
    weeksWithLessonJson: number;
    weeksWithResources: number;
    lessonCoveragePercent: number;
    resourceCoveragePercent: number;
    status: ContentFloorStatus;
  };
  subjects: ContentFloorSubjectSummary[];
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function gradeToPhase(grade: number) {
  if (grade <= 3) return "foundation";
  if (grade <= 6) return "intermediate";
  if (grade <= 9) return "senior";
  return "fet";
}

function resolveRepoRoot() {
  const cwd = process.cwd();
  const candidates = [cwd, path.join(cwd, ".."), path.join(cwd, "..", "..")];
  let fallback = cwd;
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "content"))) {
      fallback = candidate;
      if (existsSync(path.join(candidate, "apps"))) {
        return candidate;
      }
    }
  }
  return fallback;
}

function ensureWeekEntry(index: ContentIndex, params: {
  phase: string;
  grade: string;
  subject: string;
  term: string;
  week: string;
}) {
  if (!index.phases[params.phase]) {
    index.phases[params.phase] = { grades: {} };
  }
  const phaseNode = index.phases[params.phase];
  if (!phaseNode.grades[params.grade]) {
    phaseNode.grades[params.grade] = { subjects: {} };
  }
  const gradeNode = phaseNode.grades[params.grade];
  if (!gradeNode.subjects[params.subject]) {
    gradeNode.subjects[params.subject] = { terms: {} };
  }
  const subjectNode = gradeNode.subjects[params.subject];
  if (!subjectNode.terms[params.term]) {
    subjectNode.terms[params.term] = { weeks: {} };
  }
  const termNode = subjectNode.terms[params.term];
  if (!termNode.weeks[params.week]) {
    termNode.weeks[params.week] = { hasLessonJson: false, resourcesCount: 0, resourceTypes: [] };
  }
  return termNode.weeks[params.week];
}

function resourceTypeFromName(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.startsWith("lesson.")) return "lesson";
  if (lower.startsWith("worksheet.")) return "worksheet";
  if (lower.startsWith("assessment.")) return "assessment";
  if (lower.startsWith("memo.")) return "memo";
  if (lower.startsWith("resources.")) return "resources";
  if (lower.startsWith("teacher-notes.")) return "teacher_notes";
  if (lower.startsWith("slides.")) return "slides";
  if (lower.endsWith(".ppt") || lower.endsWith(".pptx")) return "slides";
  return "other";
}

async function scanPdfWeeks(pdfRoot: string, index: ContentIndex) {
  if (!existsSync(pdfRoot)) return;
  const phases = await fs.readdir(pdfRoot, { withFileTypes: true });
  for (const phaseEntry of phases) {
    if (!phaseEntry.isDirectory()) continue;
    if (phaseEntry.name.startsWith("_") || phaseEntry.name.toLowerCase() === "unmapped") continue;
    const phase = phaseEntry.name;
    const phasePath = path.join(pdfRoot, phase);
    const gradeDirs = await fs.readdir(phasePath, { withFileTypes: true });
    for (const gradeEntry of gradeDirs) {
      if (!gradeEntry.isDirectory() || !gradeEntry.name.startsWith("grade-")) continue;
      const grade = gradeEntry.name.replace("grade-", "");
      const gradePath = path.join(phasePath, gradeEntry.name);
      const subjectDirs = await fs.readdir(gradePath, { withFileTypes: true });
      for (const subjectEntry of subjectDirs) {
        if (!subjectEntry.isDirectory()) continue;
        const subject = subjectEntry.name;
        const subjectPath = path.join(gradePath, subjectEntry.name);
        const termDirs = await fs.readdir(subjectPath, { withFileTypes: true });
        for (const termEntry of termDirs) {
          if (!termEntry.isDirectory() || !termEntry.name.startsWith("term-")) continue;
          const term = termEntry.name.replace("term-", "");
          const termPath = path.join(subjectPath, termEntry.name);
          const weekDirs = await fs.readdir(termPath, { withFileTypes: true });
          for (const weekEntry of weekDirs) {
            if (!weekEntry.isDirectory() || !weekEntry.name.startsWith("week-")) continue;
            const week = weekEntry.name.replace("week-", "");
            const weekPath = path.join(termPath, weekEntry.name);
            const files = await fs.readdir(weekPath, { withFileTypes: true });
            const resourceFiles = files.filter((file) => file.isFile());
            const resourcesCount = resourceFiles.length;
            const resourceTypes = Array.from(
              new Set(resourceFiles.map((file) => resourceTypeFromName(file.name)))
            ).sort();
            const entry = ensureWeekEntry(index, { phase, grade, subject, term, week });
            entry.resourcesCount = resourcesCount;
            entry.resourceTypes = resourceTypes;
          }
        }
      }
    }
  }
}

async function scanLessonJson(lessonsRoot: string, index: ContentIndex) {
  if (!existsSync(lessonsRoot)) return;
  const gradeDirs = await fs.readdir(lessonsRoot, { withFileTypes: true });
  for (const gradeEntry of gradeDirs) {
    if (!gradeEntry.isDirectory() || !gradeEntry.name.startsWith("grade-")) continue;
    const gradeKey = gradeEntry.name.replace("grade-", "");
    const gradeNumber = Number(gradeKey);
    const phase = gradeToPhase(Number.isFinite(gradeNumber) ? gradeNumber : 0);
    const gradePath = path.join(lessonsRoot, gradeEntry.name);
    const subjectDirs = await fs.readdir(gradePath, { withFileTypes: true });
    for (const subjectEntry of subjectDirs) {
      if (!subjectEntry.isDirectory()) continue;
      const subject = subjectEntry.name;
      const subjectPath = path.join(gradePath, subjectEntry.name);
      const termDirs = await fs.readdir(subjectPath, { withFileTypes: true });
      for (const termEntry of termDirs) {
        if (!termEntry.isDirectory() || !termEntry.name.startsWith("term-")) continue;
        const term = termEntry.name.replace("term-", "");
        const termPath = path.join(subjectPath, termEntry.name);
        const weekFiles = await fs.readdir(termPath, { withFileTypes: true });
        for (const weekEntry of weekFiles) {
          if (!weekEntry.isFile() || !weekEntry.name.startsWith("week-")) continue;
          const match = weekEntry.name.match(/^week-([0-9]{2})\.json$/);
          if (!match) continue;
          const week = match[1];
          const entry = ensureWeekEntry(index, { phase, grade: gradeKey, subject, term, week });
          entry.hasLessonJson = true;
        }
      }
    }
  }
}

export async function generateContentIndex(repoRoot?: string) {
  const root = repoRoot || resolveRepoRoot();
  const index: ContentIndex = {
    generated_at: new Date().toISOString(),
    stats: {
      total_week_folders: 0,
      weeks_with_json: 0,
      weeks_with_resources_only: 0,
      phases: 0,
      grades: 0,
      subjects: 0,
    },
    phases: {},
  };
  await scanPdfWeeks(path.join(root, "content", "pdf"), index);
  await scanLessonJson(path.join(root, "content", "lessons"), index);
  index.generated_at = new Date().toISOString();
  index.stats = summarizeContentIndex(index);
  index.phases = sortIndex(index.phases);
  return index;
}

export async function writeContentIndex(repoRoot?: string) {
  const root = repoRoot || resolveRepoRoot();
  const index = await generateContentIndex(root);
  const targetPath = path.join(root, "content", "content_index.json");
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, JSON.stringify(index, null, 2));
  return index;
}

export function summarizeContentIndex(index: ContentIndex | null): ContentIndexStats {
  if (!index) {
    return {
      total_week_folders: 0,
      weeks_with_json: 0,
      weeks_with_resources_only: 0,
      phases: 0,
      grades: 0,
      subjects: 0,
    };
  }
  let totalWeeks = 0;
  let weeksWithJson = 0;
  let weeksResourcesOnly = 0;
  let grades = 0;
  let subjects = 0;

  const phaseKeys = Object.keys(index.phases || {});
  for (const phaseKey of phaseKeys) {
    const gradeEntries = index.phases[phaseKey]?.grades || {};
    for (const gradeKey of Object.keys(gradeEntries)) {
      grades += 1;
      const subjectEntries = gradeEntries[gradeKey]?.subjects || {};
      for (const subjectKey of Object.keys(subjectEntries)) {
        subjects += 1;
        const termEntries = subjectEntries[subjectKey]?.terms || {};
        for (const termKey of Object.keys(termEntries)) {
          const weekEntries = termEntries[termKey]?.weeks || {};
          for (const weekKey of Object.keys(weekEntries)) {
            totalWeeks += 1;
            const week = weekEntries[weekKey];
            if (week.hasLessonJson) {
              weeksWithJson += 1;
            } else if (week.resourcesCount > 0) {
              weeksResourcesOnly += 1;
            }
          }
        }
      }
    }
  }

  return {
    total_week_folders: totalWeeks,
    weeks_with_json: weeksWithJson,
    weeks_with_resources_only: weeksResourcesOnly,
    phases: phaseKeys.length,
    grades,
    subjects,
  };
}

export function normalizeGradeKey(grade: string | number) {
  const numeric = typeof grade === "number" ? grade : Number(grade);
  if (!Number.isFinite(numeric)) return String(grade);
  return pad2(numeric);
}

function coveragePercent(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 1000) / 10;
}

function contentFloorStatus(
  lessonCoveragePercent: number,
  resourceCoveragePercent: number,
  thresholds: ContentFloorReport["thresholds"],
): ContentFloorStatus {
  if (
    lessonCoveragePercent >= thresholds.greenLessonCoveragePercent &&
    resourceCoveragePercent >= thresholds.minimumResourceCoveragePercent
  ) {
    return "green";
  }
  if (lessonCoveragePercent >= thresholds.amberLessonCoveragePercent && resourceCoveragePercent > 0) {
    return "amber";
  }
  return "red";
}

export function evaluateContentFloor(
  index: ContentIndex | null,
  thresholds: Partial<ContentFloorReport["thresholds"]> = {},
): ContentFloorReport {
  const resolvedThresholds = {
    greenLessonCoveragePercent: thresholds.greenLessonCoveragePercent ?? 80,
    amberLessonCoveragePercent: thresholds.amberLessonCoveragePercent ?? 50,
    minimumResourceCoveragePercent: thresholds.minimumResourceCoveragePercent ?? 90,
  };
  const subjects: ContentFloorSubjectSummary[] = [];
  let totalWeeks = 0;
  let weeksWithLessonJson = 0;
  let weeksWithResources = 0;

  for (const [phase, phaseNode] of Object.entries(index?.phases ?? {})) {
    for (const [grade, gradeNode] of Object.entries(phaseNode.grades)) {
      for (const [subject, subjectNode] of Object.entries(gradeNode.subjects)) {
        let subjectWeeks = 0;
        let subjectLessonWeeks = 0;
        let subjectResourceWeeks = 0;
        for (const termNode of Object.values(subjectNode.terms)) {
          for (const week of Object.values(termNode.weeks)) {
            subjectWeeks += 1;
            if (week.hasLessonJson) subjectLessonWeeks += 1;
            if (week.resourcesCount > 0) subjectResourceWeeks += 1;
          }
        }
        const lessonCoveragePercent = coveragePercent(subjectLessonWeeks, subjectWeeks);
        const resourceCoveragePercent = coveragePercent(subjectResourceWeeks, subjectWeeks);
        subjects.push({
          phase,
          grade,
          subject,
          totalWeeks: subjectWeeks,
          weeksWithLessonJson: subjectLessonWeeks,
          weeksWithResources: subjectResourceWeeks,
          lessonCoveragePercent,
          resourceCoveragePercent,
          status: contentFloorStatus(lessonCoveragePercent, resourceCoveragePercent, resolvedThresholds),
        });
        totalWeeks += subjectWeeks;
        weeksWithLessonJson += subjectLessonWeeks;
        weeksWithResources += subjectResourceWeeks;
      }
    }
  }

  const lessonCoveragePercent = coveragePercent(weeksWithLessonJson, totalWeeks);
  const resourceCoveragePercent = coveragePercent(weeksWithResources, totalWeeks);
  return {
    generated_at: index?.generated_at ?? new Date().toISOString(),
    thresholds: resolvedThresholds,
    overall: {
      totalWeeks,
      weeksWithLessonJson,
      weeksWithResources,
      lessonCoveragePercent,
      resourceCoveragePercent,
      status: contentFloorStatus(lessonCoveragePercent, resourceCoveragePercent, resolvedThresholds),
    },
    subjects: subjects.sort((a, b) =>
      `${a.phase}-${a.grade}-${a.subject}`.localeCompare(`${b.phase}-${b.grade}-${b.subject}`),
    ),
  };
}

function sortIndex(phases: ContentIndex["phases"]) {
  const sortedPhases: ContentIndex["phases"] = {};
  Object.keys(phases)
    .sort()
    .forEach((phaseKey) => {
      const phase = phases[phaseKey];
      const sortedGrades: Record<string, any> = {};
      Object.keys(phase.grades)
        .sort()
        .forEach((gradeKey) => {
          const grade = phase.grades[gradeKey];
          const sortedSubjects: Record<string, any> = {};
          Object.keys(grade.subjects)
            .sort()
            .forEach((subjectKey) => {
              const subject = grade.subjects[subjectKey];
              const sortedTerms: Record<string, any> = {};
              Object.keys(subject.terms)
                .sort()
                .forEach((termKey) => {
                  const term = subject.terms[termKey];
                  const sortedWeeks: Record<string, any> = {};
                  Object.keys(term.weeks)
                    .sort()
                    .forEach((weekKey) => {
                      sortedWeeks[weekKey] = term.weeks[weekKey];
                    });
                  sortedTerms[termKey] = { weeks: sortedWeeks };
                });
              sortedSubjects[subjectKey] = { terms: sortedTerms };
            });
          sortedGrades[gradeKey] = { subjects: sortedSubjects };
        });
      sortedPhases[phaseKey] = { grades: sortedGrades };
    });
  return sortedPhases;
}
