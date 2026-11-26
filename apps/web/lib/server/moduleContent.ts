import "server-only";

import { readLessonJson } from "@saedu/shared";
import { listGeneratedModuleCodes, loadGeneratedModuleContent } from "./languageContent";

type GeneratedModuleContent = {
  moduleCode?: string;
  moduleName?: string;
  institution?: string;
  semester?: string;
  programme?: string;
  confidence?: number;
  generatedAt?: string;
  missingContent?: string[];
  studyUnits?: string[];
  chapters?: string[];
  keyTopics?: string[];
  quizSignals?: string[];
  assessmentPlan?: unknown[];
  classSchedule?: unknown[];
  chapterInsights?: Array<{
    chapter?: string;
    title?: string;
    outcomes?: string[];
    formulas?: string[];
    definitions?: Array<{ term?: string; definition?: string }>;
    revisionPrompts?: string[];
    saContext?: string;
  }>;
};

export type ModuleSummary = {
  moduleCode: string;
  moduleName: string;
  institution: string | null;
  semester: string | null;
  programme: string | null;
  confidence: number;
  generatedAt: string | null;
  studyUnitCount: number;
  chapterCount: number;
  keyTopicCount: number;
  assessmentCount: number;
  scheduleCount: number;
  missingContent: string[];
  lessonAvailability: {
    availableCount: number;
    totalCount: number;
    label: string;
  };
};

export type ModuleDetail = ModuleSummary & {
  studyUnits: string[];
  chapters: Array<{
    id: string;
    title: string;
    summary: string;
    outcomes: string[];
    formulas: string[];
    definitions: Array<{ term: string; definition: string }>;
    revisionPrompts: string[];
    saContext: string | null;
  }>;
  keyTopics: string[];
  quizSignals: string[];
};

function toModuleSummary(content: GeneratedModuleContent, fallbackCode: string): ModuleSummary {
  const moduleCode = (content.moduleCode ?? fallbackCode).toUpperCase();
  const chapterCount = content.chapterInsights?.length ?? content.chapters?.length ?? 0;
  const chapterTotal = chapterCount;
  let availableCount = 0;

  for (let index = 0; index < chapterTotal; index += 1) {
    const lesson = readLessonJson({
      gradeKey: moduleCode.match(/\d/)?.[0] ?? "2",
      subjectKey: moduleCode,
      termKey: "1",
      weekNumber: index + 1,
    });
    if (lesson) {
      availableCount += 1;
    }
  }

  return {
    moduleCode,
    moduleName: content.moduleName ?? moduleCode,
    institution: content.institution ?? null,
    semester: content.semester ?? null,
    programme: content.programme ?? null,
    confidence: typeof content.confidence === "number" ? content.confidence : 0.5,
    generatedAt: typeof content.generatedAt === "string" ? content.generatedAt : null,
    studyUnitCount: content.studyUnits?.length ?? 0,
    chapterCount,
    keyTopicCount: content.keyTopics?.length ?? 0,
    assessmentCount: content.assessmentPlan?.length ?? 0,
    scheduleCount: content.classSchedule?.length ?? 0,
    missingContent: content.missingContent ?? [],
    lessonAvailability: {
      availableCount,
      totalCount: chapterTotal,
      label:
        chapterTotal > 0
          ? availableCount === chapterTotal
            ? `${availableCount}/${chapterTotal} live lessons`
            : `${availableCount}/${chapterTotal} live`
          : "No live lessons",
    },
  };
}

function toModuleDetail(content: GeneratedModuleContent, fallbackCode: string): ModuleDetail {
  const summary = toModuleSummary(content, fallbackCode);
  const chapters =
    content.chapterInsights?.map((chapter, index) => {
      const title = chapter.title?.trim() || chapter.chapter?.trim() || `Chapter ${index + 1}`;
      const outcomes = chapter.outcomes ?? [];
      const definitions =
        chapter.definitions?.map((definition) => ({
          term: definition.term?.trim() || title,
          definition: definition.definition?.trim() || "",
        })) ?? [];

      const summaryText =
        outcomes[0] ??
        chapter.saContext ??
        chapter.revisionPrompts?.[0] ??
        chapter.formulas?.[0] ??
        `Study the core ideas in ${title}.`;

      return {
        id: chapter.chapter?.replace(/^Ch/i, "").replace(/[^0-9A-Za-z]+/g, "") || String(index + 1),
        title,
        summary: summaryText,
        outcomes,
        formulas: chapter.formulas ?? [],
        definitions,
        revisionPrompts: chapter.revisionPrompts ?? [],
        saContext: chapter.saContext ?? null,
      };
    }) ?? [];

  return {
    ...summary,
    studyUnits: content.studyUnits ?? [],
    chapters,
    keyTopics: content.keyTopics ?? [],
    quizSignals: content.quizSignals ?? [],
  };
}

export function listModuleSummaries(): ModuleSummary[] {
  return listGeneratedModuleCodes()
    .map((moduleCode) => {
      const content = loadGeneratedModuleContent(moduleCode) as GeneratedModuleContent | null;
      return content ? toModuleSummary(content, moduleCode) : null;
    })
    .filter((item): item is ModuleSummary => Boolean(item))
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return a.moduleCode.localeCompare(b.moduleCode);
    });
}

export function loadModuleDetail(moduleCode: string): ModuleDetail | null {
  const content = loadGeneratedModuleContent(moduleCode) as GeneratedModuleContent | null;
  if (!content) return null;
  return toModuleDetail(content, moduleCode);
}
