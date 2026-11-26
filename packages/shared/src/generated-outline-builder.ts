import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { loadCourseOutline } from "./curriculum.js";
import { resolveSubjectKey } from "./subject-alias.js";
import type { GeneratedOutline } from "./generated-outline.js";

type ContentIndex = {
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
                  weeks: Record<string, { hasLessonJson: boolean; resourcesCount: number; resourceTypes: string[] }>;
                }
              >;
            }
          >;
        }
      >;
    }
  >;
};

type SubjectResolutionRule = {
  source_subject_key: string;
  phase: string;
  resolved_subject_key: string;
  display_name_override?: string;
  notes?: string;
};

type InventoryPhase = ContentIndex["phases"][string];
type InventoryGrade = InventoryPhase["grades"][string];
type InventorySubject = InventoryGrade["subjects"][string];
type InventoryTerm = InventorySubject["terms"][string];
type InventoryWeek = InventoryTerm["weeks"][string];

function sortKeys<T>(obj: Record<string, T>) {
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {} as Record<string, T>);
}

function outlineSubjectKeys(outline: any, phase: string, gradeKey: string) {
  const gradeNode = outline.phases?.[phase]?.grades?.[gradeKey];
  if (!gradeNode) return [];
  const keys = new Set<string>();
  for (const group of Object.values(gradeNode.groups || {})) {
    Object.keys((group as any).subjects || {}).forEach((key) => keys.add(key));
  }
  return Array.from(keys);
}

function displayNameFromKey(key: string) {
  return key
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function loadContentIndex(repoRoot: string) {
  const filePath = path.join(repoRoot, "content", "content_index.json");
  if (!existsSync(filePath)) {
    throw new Error("content/content_index.json not found");
  }
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as ContentIndex;
}

async function loadSubjectResolutions(repoRoot: string) {
  const filePath = path.join(repoRoot, "content", "mappings", "subject_resolutions.json");
  if (!existsSync(filePath)) {
    return { updated_at: new Date().toISOString(), rules: [] as SubjectResolutionRule[] };
  }
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as { updated_at: string; rules: SubjectResolutionRule[] };
}

function findResolutionRule(rules: SubjectResolutionRule[], sourceKey: string, phase: string) {
  return (
    rules.find((rule) => rule.source_subject_key === sourceKey && rule.phase === phase) ||
    rules.find((rule) => rule.source_subject_key === sourceKey && rule.phase === "any")
  );
}

async function writeReport(repoRoot: string, outline: GeneratedOutline) {
  const lines = [
    "# Generated Outline Report",
    "",
    `Generated: ${outline.generated_at}`,
    "",
    "## Stats",
    "",
    `Total subjects: ${outline.stats.total_subjects}`,
    `Unclassified subjects: ${outline.stats.unclassified_subjects}`,
    `Total week nodes: ${outline.stats.total_week_nodes}`,
    "",
  ];

  const unclassified: string[] = [];
  for (const [phaseKey, phase] of Object.entries(outline.phases)) {
    for (const [gradeKey, grade] of Object.entries(phase.grades)) {
      for (const entry of grade.unclassified_subjects) {
        unclassified.push(`${phaseKey} Grade ${gradeKey}: ${entry.sourceKey} (${entry.reason})`);
      }
    }
  }

  if (unclassified.length) {
    lines.push("## Unclassified subjects", "");
    unclassified.slice(0, 50).forEach((line) => lines.push(`- ${line}`));
    lines.push("");
  }

  const reportPath = path.join(repoRoot, "content", "reports", "generated_outline_report.md");
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, lines.join("\n"));
}

export async function writeGeneratedOutline(repoRoot: string) {
  const inventory = await loadContentIndex(repoRoot);
  const outline = loadCourseOutline();
  const resolutionStore = await loadSubjectResolutions(repoRoot);
  const rules = resolutionStore.rules || [];

  const generated: GeneratedOutline = {
    generated_at: new Date().toISOString(),
    stats: {
      total_subjects: 0,
      unclassified_subjects: 0,
      total_week_nodes: 0,
    },
    phases: {},
  };

  for (const [phaseKey, phase] of Object.entries(inventory.phases || {}) as Array<[string, InventoryPhase]>) {
    const phaseNode = { grades: {} as GeneratedOutline["phases"][string]["grades"] };
    for (const [gradeKey, grade] of Object.entries(phase.grades || {}) as Array<[string, InventoryGrade]>) {
      const normalizedGradeKey = gradeKey === "00" ? "R" : String(Number.parseInt(gradeKey, 10));
      const outlineKeys = outlineSubjectKeys(outline, phaseKey, normalizedGradeKey);
      const gradeNode = {
        subjects: {} as Record<string, any>,
        unclassified_subjects: [] as GeneratedOutline["phases"][string]["grades"][string]["unclassified_subjects"],
      };

      for (const [subjectKey, subject] of Object.entries(grade.subjects || {}) as Array<[string, InventorySubject]>) {
        const resolutionRule = findResolutionRule(rules, subjectKey, phaseKey);
        const resolved = resolutionRule
          ? {
              subjectKey: resolutionRule.resolved_subject_key,
              confidence: "high",
              reason: "resolved by admin",
            }
          : resolveSubjectKey({
              phase: phaseKey,
              grade: Number.parseInt(gradeKey, 10),
              filename: subjectKey,
              outlineKeys,
            });

        if (!resolved.subjectKey || resolved.confidence !== "high") {
          const mappedTerms: Record<
            string,
            { weeks: Record<string, { hasLessonJson: boolean; resourcesCount: number; resourcesOnly: boolean }> }
          > = {};
          for (const [termKey, term] of Object.entries(subject.terms || {}) as Array<[string, InventoryTerm]>) {
            const termWeeks: Record<string, { hasLessonJson: boolean; resourcesCount: number; resourcesOnly: boolean }> =
              {};
            for (const [weekKey, week] of Object.entries(term.weeks || {}) as Array<[string, InventoryWeek]>) {
              termWeeks[weekKey] = {
                hasLessonJson: week.hasLessonJson,
                resourcesCount: week.resourcesCount,
                resourcesOnly: !week.hasLessonJson && week.resourcesCount > 0,
              };
              generated.stats.total_week_nodes += 1;
            }
            mappedTerms[termKey] = { weeks: termWeeks };
          }
          gradeNode.unclassified_subjects.push({
            sourceKey: subjectKey,
            reason: resolved.reason || "unresolved",
            terms: mappedTerms,
          });
          continue;
        }

        if (!outlineKeys.includes(resolved.subjectKey)) {
          const mappedTerms: Record<
            string,
            { weeks: Record<string, { hasLessonJson: boolean; resourcesCount: number; resourcesOnly: boolean }> }
          > = {};
          for (const [termKey, term] of Object.entries(subject.terms || {}) as Array<[string, InventoryTerm]>) {
            const termWeeks: Record<string, { hasLessonJson: boolean; resourcesCount: number; resourcesOnly: boolean }> =
              {};
            for (const [weekKey, week] of Object.entries(term.weeks || {}) as Array<[string, InventoryWeek]>) {
              termWeeks[weekKey] = {
                hasLessonJson: week.hasLessonJson,
                resourcesCount: week.resourcesCount,
                resourcesOnly: !week.hasLessonJson && week.resourcesCount > 0,
              };
              generated.stats.total_week_nodes += 1;
            }
            mappedTerms[termKey] = { weeks: termWeeks };
          }
          gradeNode.unclassified_subjects.push({
            sourceKey: subjectKey,
            reason: "resolved key not valid for grade",
            terms: mappedTerms,
          });
          continue;
        }

        const normalizedKey = resolved.subjectKey;
        const displayName =
          resolutionRule?.display_name_override || displayNameFromKey(normalizedKey);
        const existing = gradeNode.subjects[normalizedKey];

        const mergedTerms = existing?.terms || {};
        for (const [termKey, term] of Object.entries(subject.terms || {}) as Array<[string, InventoryTerm]>) {
          const termWeeks = mergedTerms[termKey]?.weeks || {};
          for (const [weekKey, week] of Object.entries(term.weeks || {}) as Array<[string, InventoryWeek]>) {
            termWeeks[weekKey] = {
              hasLessonJson: week.hasLessonJson,
              resourcesCount: week.resourcesCount,
              resourcesOnly: !week.hasLessonJson && week.resourcesCount > 0,
            };
            generated.stats.total_week_nodes += 1;
          }
          mergedTerms[termKey] = { weeks: termWeeks };
        }

        gradeNode.subjects[normalizedKey] = {
          displayName,
          sourceKey: subjectKey,
          terms: mergedTerms,
        };
      }

      for (const subject of Object.values(gradeNode.subjects) as Array<GeneratedOutline["phases"][string]["grades"][string]["subjects"][string]>) {
        subject.terms = sortKeys(subject.terms);
        for (const term of Object.values(subject.terms) as Array<{ weeks: Record<string, any> }>) {
          term.weeks = sortKeys(term.weeks);
        }
      }
      gradeNode.subjects = sortKeys(gradeNode.subjects);
      gradeNode.unclassified_subjects = gradeNode.unclassified_subjects
        .map((entry: any) => ({
          ...entry,
          terms: sortKeys(entry.terms),
        }))
        .sort((a: any, b: any) => a.sourceKey.localeCompare(b.sourceKey));
      for (const entry of gradeNode.unclassified_subjects) {
        for (const term of Object.values(entry.terms)) {
          (term as { weeks: Record<string, { hasLessonJson: boolean; resourcesCount: number; resourcesOnly: boolean }> }).weeks = sortKeys(term.weeks);
        }
      }
      phaseNode.grades[gradeKey] = gradeNode;
    }

    phaseNode.grades = sortKeys(phaseNode.grades);
    generated.phases[phaseKey] = phaseNode;
  }

  generated.phases = sortKeys(generated.phases);
  generated.stats.total_subjects = Object.values(generated.phases).reduce((acc: number, phase) => {
    return (
      acc +
      Object.values(phase.grades).reduce(
        (gradeAcc: number, grade) => gradeAcc + Object.keys(grade.subjects).length + grade.unclassified_subjects.length,
        0
      )
    );
  }, 0);
  generated.stats.unclassified_subjects = Object.values(generated.phases).reduce(
    (acc: number, phase) =>
      acc +
      Object.values(phase.grades).reduce(
        (gradeAcc: number, grade) => gradeAcc + grade.unclassified_subjects.length,
        0
      ),
    0
  );

  const outputPath = path.join(repoRoot, "content", "generated_course_outline.json");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(generated, null, 2));
  await writeReport(repoRoot, generated);

  return generated;
}
