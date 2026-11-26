import { getAuthToken } from "../auth/tokenStore";

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

export type ModuleChapter = {
  id: string;
  title: string;
  summary: string;
  outcomes: string[];
  formulas: string[];
  definitions: { term: string; definition: string }[];
  revisionPrompts: string[];
  saContext: string | null;
};

export type ModuleDetail = ModuleSummary & {
  studyUnits: string[];
  chapters: ModuleChapter[];
  keyTopics: string[];
  quizSignals: string[];
};

export type LessonSection = {
  heading: string;
  content: string;
};

export type LessonContent = {
  title: string;
  summary: string;
  objectives: string[];
  sections: {
    explanation: LessonSection[];
    worked_examples: LessonSection[];
    guided_practice: LessonSection[];
    independent_practice: LessonSection[];
  };
  quiz: {
    questions: {
      id: string;
      type: "mcq" | "short_answer";
      prompt: string;
      options?: string[];
      answer: string;
      explanation: string;
    }[];
  };
  teacher_notes?: string[];
  citations: {
    source_path: string;
    page_start: number;
    page_end: number;
  }[];
};

export type LessonLookup = {
  grade: number;
  subject: string;
  term: number;
  week: number;
};

export type Flashcard = {
  front: string;
  back: string;
};

type ModuleCatalogResponse = {
  generatedAt: string;
  modules: ModuleSummary[];
};

const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://school.ditshego-ventures.co.za";

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(`${webBaseUrl}${path}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

async function webFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAuthToken();
  const response = await fetch(`${webBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchModuleCatalog() {
  return requestJson<ModuleCatalogResponse>("/api/modules");
}

export async function fetchModuleDetail(moduleCode: string) {
  return requestJson<ModuleDetail>(`/api/modules/${encodeURIComponent(moduleCode)}`);
}

export function resolveLessonLookup(moduleCode: string, chapterId: string): LessonLookup | null {
  const code = moduleCode.trim().toUpperCase();
  const chapterNumber = Number.parseInt(chapterId, 10);
  if (!code || !Number.isFinite(chapterNumber) || chapterNumber < 1) {
    return null;
  }

  const yearMatch = code.match(/(\d)(\d{2})$/);
  const grade = yearMatch ? Number(yearMatch[1]) : 2;

  return {
    grade,
    subject: code.toLowerCase(),
    term: 1,
    week: chapterNumber,
  };
}

export async function fetchLessonDetail(lookup: LessonLookup) {
  const params = new URLSearchParams({
    grade: String(lookup.grade),
    subject: lookup.subject,
    term: String(lookup.term),
    week: String(lookup.week),
  });

  return requestJson<LessonContent>(`/api/lesson-json?${params.toString()}`);
}

export async function generateFlashcards(params: {
  moduleCode: string;
  chapterId?: string;
  count?: number;
}) {
  const payload: Record<string, string | number> = {
    moduleCode: params.moduleCode,
  };

  if (params.chapterId) payload.chapterId = params.chapterId;
  if (typeof params.count === "number") payload.count = params.count;

  const response = await webFetch<{ cards?: Flashcard[]; flashcards?: Flashcard[] }>("/api/intelligence/flashcards", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const cards = response.cards ?? response.flashcards ?? [];
  return cards.filter((card): card is Flashcard => Boolean(card && typeof card.front === "string" && typeof card.back === "string"));
}

export function getFeaturedModule(modules: ModuleSummary[]) {
  const priority = ["EKRP211", "ECON211", "EKIP212"];
  for (const code of priority) {
    const module = modules.find((item) => item.moduleCode.toUpperCase() === code);
    if (module) return module;
  }
  return modules[0] ?? null;
}

export function buildModuleSubtitle(module: ModuleSummary) {
  const parts = [module.programme ?? "Study module"];
  if (module.semester) parts.push(module.semester);
  if (module.confidence) parts.push(`${Math.round(module.confidence * 100)}% live`);
  return parts.join(" · ");
}

export function buildChapterSummary(chapter: ModuleChapter) {
  return chapter.summary || chapter.outcomes[0] || chapter.saContext || "Open chapter";
}

export function lessonSectionsToChapterBody(lesson: LessonContent) {
  const sections: { heading: string; body: string }[] = [];

  if (lesson.objectives.length) {
    sections.push({
      heading: "Objectives",
      body: lesson.objectives.map((objective) => `• ${objective}`).join("\n"),
    });
  }

  const lessonBlocks: [string, LessonSection[]][] = [
    ["Explanation", lesson.sections.explanation],
    ["Worked examples", lesson.sections.worked_examples],
    ["Guided practice", lesson.sections.guided_practice],
    ["Independent practice", lesson.sections.independent_practice],
  ];

  for (const [heading, blocks] of lessonBlocks) {
    if (!blocks.length) continue;
    sections.push({
      heading,
      body: blocks.map((block) => `${block.heading}\n${block.content}`).join("\n\n"),
    });
  }

  if (lesson.quiz.questions.length) {
    sections.push({
      heading: "Quiz",
      body: lesson.quiz.questions
        .map((question, index) => {
          const options = question.options?.length ? `\nOptions: ${question.options.join(" | ")}` : "";
          return `Q${index + 1}. ${question.prompt}${options}\nAnswer: ${question.answer}\n${question.explanation}`;
        })
        .join("\n\n"),
    });
  }

  if (lesson.teacher_notes?.length) {
    sections.push({
      heading: "Teacher notes",
      body: lesson.teacher_notes.map((note) => `• ${note}`).join("\n"),
    });
  }

  if (lesson.citations.length) {
    sections.push({
      heading: "References",
      body: lesson.citations
        .map((citation) => `${citation.source_path} (pages ${citation.page_start}-${citation.page_end})`)
        .join("\n"),
    });
  }

  return sections;
}
