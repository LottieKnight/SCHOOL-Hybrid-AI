import "server-only";

import fs from "node:fs";
import path from "node:path";

type ModuleGeneratedContent = {
  moduleCode?: string;
  moduleName?: string;
  keyTopics?: string[];
  commonExamErrors?: string[];
  chapters?: string[];
  chapterInsights?: Array<{
    chapter?: string;
    title?: string;
    definitions?: string[];
    outcomes?: string[];
    formulas?: string[];
    revisionPrompts?: string[];
    saContext?: string;
  }>;
  chapterStudyItems?: Array<{
    chapter?: string;
    flashcards?: Array<{ front?: string; back?: string }>;
    quizItems?: Array<{ prompt?: string; answer?: string; explanation?: string }>;
  }>;
};

export type GroundedSearchResult = {
  title: string;
  sourceType: string;
  sourceId: string;
  snippet: string;
  score: number;
};

export type ModuleMatch = {
  moduleCode: string;
  confidence: number;
};

function repoRoot() {
  return process.cwd();
}

function moduleFilePath(moduleCode: string) {
  return path.join(repoRoot(), "content", "modules-generated", `${moduleCode.toLowerCase()}.generated.json`);
}

function modulesDir() {
  return path.join(repoRoot(), "content", "modules-generated");
}

function tokenize(value: string) {
  if (typeof value !== "string") return [];
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2);
}

function asLowercaseString(value: unknown) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function overlapScore(tokens: string[], haystack: unknown) {
  if (typeof haystack !== "string") return 0;
  const hayTokens = new Set(tokenize(haystack));
  if (tokens.length === 0 || hayTokens.size === 0) return 0;
  let score = 0;
  for (const token of tokens) {
    if (hayTokens.has(token)) {
      score += token.length >= 8 ? 0.08 : 0.05;
    }
  }
  return score;
}

export function listGeneratedModuleCodes() {
  const dir = modulesDir();
  if (!fs.existsSync(dir)) return [] as string[];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.generated.json') && name !== 'index.json')
    .map((name) => name.replace(/\.generated\.json$/i, '').toUpperCase())
    .sort();
}

export function loadGeneratedModuleContent(moduleCode?: string | null): ModuleGeneratedContent | null {
  if (typeof moduleCode !== "string" || !moduleCode.trim()) return null;
  const filePath = moduleFilePath(moduleCode);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as ModuleGeneratedContent;
  } catch {
    return null;
  }
}

function scoreModuleMatch(query: string, content: ModuleGeneratedContent, fallbackModuleCode: string) {
  const lowered = asLowercaseString(query);
  const tokens = typeof query === "string" ? tokenize(query) : [];
  let score = 0;

  const code = asLowercaseString(content.moduleCode ?? fallbackModuleCode);
  const name = asLowercaseString(content.moduleName);
  if (code && lowered.includes(code)) score += 0.7;
  if (name && lowered.includes(name)) score += 0.5;

  for (const topic of content.keyTopics ?? []) {
    score += Math.min(0.35, overlapScore(tokens, topic));
  }

  for (const insight of content.chapterInsights ?? []) {
    for (const candidate of [insight.title ?? '', ...(insight.definitions ?? []), ...(insight.formulas ?? []), ...(insight.outcomes ?? [])]) {
      score += Math.min(0.25, overlapScore(tokens, candidate));
    }
    if (insight.saContext) {
      score += Math.min(0.18, overlapScore(tokens, insight.saContext));
    }
  }

  for (const studyItem of content.chapterStudyItems ?? []) {
    for (const flashcard of studyItem.flashcards ?? []) {
      score += Math.min(0.12, overlapScore(tokens, [flashcard.front, flashcard.back].filter(Boolean).join(' ')));
    }
    for (const quizItem of studyItem.quizItems ?? []) {
      score += Math.min(0.12, overlapScore(tokens, [quizItem.prompt, quizItem.answer, quizItem.explanation].filter(Boolean).join(' ')));
    }
  }

  return score;
}

export function inferRelevantGeneratedModules(input: { query: string; preferredModuleCode?: string | null; limit?: number }): ModuleMatch[] {
  if (typeof input.query !== "string") return [];
  const preferred = typeof input.preferredModuleCode === 'string' ? input.preferredModuleCode.trim().toUpperCase() : '';
  const candidates = new Map<string, number>();

  if (preferred) {
    candidates.set(preferred, 0.95);
  }

  for (const moduleCode of listGeneratedModuleCodes()) {
    const content = loadGeneratedModuleContent(moduleCode);
    if (!content) continue;
    const score = scoreModuleMatch(input.query, content, moduleCode);
    if (score > 0.08) {
      candidates.set(moduleCode, Math.max(candidates.get(moduleCode) ?? 0, Math.min(0.93, score)));
    }
  }

  return Array.from(candidates.entries())
    .map(([moduleCode, confidence]) => ({ moduleCode, confidence }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, input.limit ?? 3);
}

export function searchGeneratedModuleContent(input: { moduleCode?: string | null; query: string }): GroundedSearchResult[] {
  if (typeof input.query !== "string") return [];
  const content = loadGeneratedModuleContent(input.moduleCode);
  if (!content) return [];

  const tokens = tokenize(input.query);
  const results: GroundedSearchResult[] = [];

  const pushIfMatch = (title: string, sourceId: string, snippet: string, scoreBase: number, sourceType = "module-generated") => {
    const overlap = overlapScore(tokens, `${title} ${snippet}`);
    if (overlap <= 0) return;
    results.push({
      title,
      sourceType,
      sourceId,
      snippet,
      score: Math.min(0.99, scoreBase + overlap),
    });
  };

  for (const topic of content.keyTopics ?? []) {
    pushIfMatch(`${content.moduleCode ?? input.moduleCode}: key topic`, `topic:${topic}`, topic, 0.78, "module-topic");
  }

  for (const error of content.commonExamErrors ?? []) {
    pushIfMatch(`${content.moduleCode ?? input.moduleCode}: exam error`, `error:${error.slice(0, 24)}`, error, 0.8, "exam-error");
  }

  for (const insight of content.chapterInsights ?? []) {
    const title = `${insight.chapter ?? "Chapter"} · ${insight.title ?? "Insight"}`;
    for (const definition of insight.definitions ?? []) {
      pushIfMatch(title, `definition:${title}:${definition.slice(0, 24)}`, definition, 0.83, "definition");
    }
    for (const formula of insight.formulas ?? []) {
      pushIfMatch(title, `formula:${title}:${formula.slice(0, 24)}`, formula, 0.82, "formula");
    }
    for (const outcome of insight.outcomes ?? []) {
      pushIfMatch(title, `outcome:${title}:${outcome.slice(0, 24)}`, outcome, 0.77, "learning-outcome");
    }
    if (insight.saContext) {
      pushIfMatch(title, `context:${title}`, insight.saContext, 0.79, "sa-context");
    }
  }

  for (const studyItem of content.chapterStudyItems ?? []) {
    const title = `${studyItem.chapter ?? "Chapter"} study items`;
    for (const flashcard of studyItem.flashcards ?? []) {
      const snippet = [flashcard.front, flashcard.back].filter(Boolean).join(" — ");
      pushIfMatch(title, `flashcard:${title}:${flashcard.front?.slice(0, 24) ?? "x"}`, snippet, 0.76, "flashcard");
    }
    for (const quizItem of studyItem.quizItems ?? []) {
      const snippet = [quizItem.prompt, quizItem.answer, quizItem.explanation].filter(Boolean).join(" — ");
      pushIfMatch(title, `quiz:${title}:${quizItem.prompt?.slice(0, 24) ?? "x"}`, snippet, 0.75, "quiz-item");
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

export function searchAcrossGeneratedModules(input: { query: string; preferredModuleCode?: string | null; limit?: number }) {
  const moduleMatches = inferRelevantGeneratedModules({
    query: input.query,
    preferredModuleCode: input.preferredModuleCode,
    limit: 4,
  });

  const merged = moduleMatches.flatMap((match) =>
    searchGeneratedModuleContent({ moduleCode: match.moduleCode, query: input.query }).map((item) => ({
      ...item,
      score: Math.min(0.99, item.score + match.confidence * 0.04),
    }))
  );

  return merged
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit ?? 10);
}

export function explainFromGeneratedModuleContent(input: { moduleCode?: string | null; term: string }) {
  const results = input.moduleCode
    ? searchGeneratedModuleContent({ moduleCode: input.moduleCode, query: input.term })
    : searchAcrossGeneratedModules({ query: input.term, limit: 6 });
  if (results.length === 0) return null;

  return {
    explanation: results[0].snippet,
    sourceRefs: results.slice(0, 3).map((item) => ({ type: item.sourceType, id: item.sourceId })),
    relatedTerms: results.slice(1, 4).map((item) => item.title),
  };
}
