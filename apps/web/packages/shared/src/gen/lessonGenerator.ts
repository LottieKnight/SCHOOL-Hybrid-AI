import { existsSync } from "node:fs";
import path from "node:path";
import { QuizSchema, type Quiz, type QuizQuestion } from "../lesson-content.js";
import { generateQuiz } from "../quiz-generator.js";
import { retrieveChunks, type RagChunkScore } from "../rag/retrieval.js";
import { loadCapsScaffold, type CapsScaffoldWeek } from "./caps-scaffold.js";

export type GenerateAiLessonInput = {
  phase: "foundation" | "intermediate" | "senior" | "fet";
  grade: number;
  subjectKey: string;
  term: number;
  week: number;
  lessonIndex?: number;
  topic?: string;
};

export type GenerateAiLessonOptions = {
  k?: number;
  apiKey?: string;
  apiBase?: string;
  model?: string;
};

export type LessonNoteSection = {
  title: string;
  bullets: string[];
};

export type LessonCitation = {
  file_path: string;
  page_start: number;
  page_end: number;
  note?: string;
};

export type GeneratedLessonContent = {
  title: string;
  topic: string;
  summary: string;
  learningOutcomes: string[];
  lessonNotes: LessonNoteSection[];
  workedExamples: string[];
  practice: { easy: string[]; medium: string[]; hard: string[] };
  quiz: Quiz;
  memo: { questionId: string; answer: string; explanation?: string }[];
  teacherNotes?: string[];
  citations: LessonCitation[];
};

export type GeneratedAiLessonResult = {
  content: GeneratedLessonContent;
  usedChunks: RagChunkScore[];
  usedModel: boolean;
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "that",
  "with",
  "from",
  "this",
  "these",
  "those",
  "into",
  "there",
  "their",
  "about",
  "could",
  "should",
  "would",
  "which",
  "what",
  "when",
  "where",
  "while",
  "your",
  "yours",
  "have",
  "has",
  "had",
  "were",
  "was",
  "are",
  "for",
  "but",
  "not",
  "can",
  "may",
  "will",
  "also",
  "than",
  "then",
  "them",
  "they",
  "each",
  "over",
  "under",
  "such",
  "some",
  "more",
  "most",
  "very",
  "much",
  "many",
  "like",
  "just",
  "other",
  "out",
  "our",
  "us",
  "you",
  "she",
  "him",
  "her",
  "his",
  "its",
  "we",
  "a",
  "an",
  "in",
  "on",
  "of",
  "to",
  "is",
  "it",
  "as",
  "by",
  "be",
  "at",
  "or",
  "if",
]);

function findRepoRoot() {
  const cwd = process.cwd();
  const candidates = [cwd, path.join(cwd, ".."), path.join(cwd, "..", "..")];
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "content"))) {
      return candidate;
    }
  }
  return cwd;
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
}

function tokenize(text: string) {
  return normalizeText(text)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 3 && !STOP_WORDS.has(token));
}

function topKeywords(text: string, limit: number) {
  const counts = new Map<string, number>();
  for (const token of tokenize(text)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token)
    .slice(0, limit);
}

function normalizeWords(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function hasLongOverlap(output: string, sources: string[], minWords = 20) {
  const outputTokens = normalizeWords(output);
  if (outputTokens.length < minWords) return false;
  const sourceNgrams = new Set<string>();
  for (const source of sources) {
    const tokens = normalizeWords(source).slice(0, 2000);
    for (let i = 0; i <= tokens.length - minWords; i += 1) {
      sourceNgrams.add(tokens.slice(i, i + minWords).join(" "));
    }
  }

  for (let i = 0; i <= outputTokens.length - minWords; i += 1) {
    const key = outputTokens.slice(i, i + minWords).join(" ");
    if (sourceNgrams.has(key)) return true;
  }
  return false;
}

function findRagIndexPath() {
  const repoRoot = findRepoRoot();
  const ragPath = path.join(repoRoot, "content", "rag", "chunks.jsonl");
  return existsSync(ragPath) ? ragPath : null;
}

function asStringArray(value: any) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : String(item)))
    .map((item) => item.trim())
    .filter(Boolean);
}

function asNonEmptyString(value: any) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function extractJson(payload: string) {
  try {
    return JSON.parse(payload);
  } catch {
    const start = payload.indexOf("{");
    const end = payload.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(payload.slice(start, end + 1));
    }
    throw new Error("Failed to parse JSON from model response.");
  }
}

function getApiConfig(options: GenerateAiLessonOptions) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) return null;
  const apiBase = options.apiBase || process.env.OPENAI_API_BASE || process.env.LLM_API_BASE || "https://api.openai.com/v1";
  const model = options.model || process.env.OPENAI_MODEL || process.env.LLM_MODEL || "gpt-4o-mini";
  return { apiKey, apiBase: apiBase.replace(/\/+$/, ""), model };
}

async function callChatModel(prompt: string, options: GenerateAiLessonOptions) {
  const config = getApiConfig(options);
  if (!config) return null;
  const response = await fetch(`${config.apiBase}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content:
            "You are a CAPS-aligned lesson author. Generate original prose and do not copy source sentences.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`LLM request failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as any;
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM response missing content.");
  }
  return String(content).trim();
}

function buildPrompt(
  input: GenerateAiLessonInput,
  weekInfo: CapsScaffoldWeek | null,
  chunks: RagChunkScore[],
  hardParaphrase: boolean
) {
  const scaffoldSummary = weekInfo?.summary_md ?? "";
  const sources = chunks.map((chunk, idx) => {
    const snippet = chunk.text.replace(/\s+/g, " ").trim().slice(0, 1600);
    return `Source ${idx + 1}: ${chunk.file_path} (pages ${chunk.page_start}-${chunk.page_end})\n${snippet}`;
  });

  return [
    `Create an original CAPS-aligned lesson for ${input.phase} phase, grade ${input.grade}, subject ${input.subjectKey}, term ${input.term}, week ${input.week}.`,
    input.topic ? `Topic focus: ${input.topic}.` : "",
    weekInfo?.topic_title ? `Scaffold topic: ${weekInfo.topic_title}.` : "",
    scaffoldSummary ? `Scaffold summary: ${scaffoldSummary}` : "",
    hardParaphrase
      ? "You MUST paraphrase aggressively. Do not reuse any 20-word sequence from sources."
      : "Use sources only for grounding. Do not copy sentences verbatim.",
    "Return ONLY valid JSON with these fields:",
    "- title",
    "- topic",
    "- summary",
    "- learningOutcomes (array of strings)",
    "- lessonNotes (array of sections: { title, bullets })",
    "- workedExamples (array of strings, can be empty)",
    "- practice: { easy: string[], medium: string[], hard: string[] }",
    "- quiz: { questions: [{ id, type, prompt, options?, answer, explanation, difficulty, tags }] }",
    "- memo (array of { questionId, answer, explanation })",
    "- teacherNotes (array of strings, optional)",
    "",
    "Quiz requirements:",
    "- 6 to 10 questions",
    "- type is one of: mcq, true_false, short_answer",
    "- options only for mcq (3 to 5 options)",
    "- include answer and explanation for every question",
    sources.length ? "" : "No source excerpts provided. Use scaffold context only.",
    sources.length ? "Sources:" : "",
    sources.join("\n\n"),
  ]
    .filter(Boolean)
    .join("\n");
}

function buildMemoFromQuiz(quiz: Quiz) {
  return quiz.questions.map((question: any) => ({
    questionId: question.id,
    answer: question.answer,
    explanation: question.explanation,
  }));
}

function buildFallbackLesson(
  input: GenerateAiLessonInput,
  weekInfo: CapsScaffoldWeek | null,
  sourceText: string,
  citations: LessonCitation[]
): GeneratedLessonContent {
  const topic = input.topic || weekInfo?.topic_title || `${input.subjectKey.replace(/-/g, " ")} Week ${input.week}`;
  const keywords = topKeywords(sourceText, 6);
  const summary =
    weekInfo?.summary_md?.split("\n").slice(0, 2).join(" ") ||
    `This lesson explores ${topic} and reinforces key ideas like ${keywords.slice(0, 3).join(", ")}.`;

  const learningOutcomes = [
    `Understand the main idea behind ${topic}.`,
    `Use key vocabulary such as ${keywords[0] ?? "core terms"} correctly.`,
    `Apply the concept in short practice tasks.`,
  ];

  const lessonNotes: LessonNoteSection[] = [
    {
      title: "Key concepts",
      bullets: [
        `Define ${keywords[0] ?? "the main concept"} and connect it to prior knowledge.`,
        `Explain ${keywords[1] ?? "a supporting idea"} with a simple example.`,
        `Highlight why ${keywords[2] ?? "the topic"} matters in real life.`,
      ],
    },
    {
      title: "Teaching steps",
      bullets: [
        "Start with a quick warm-up question.",
        "Model one worked example step-by-step.",
        "Guide learners through a short paired activity.",
        "Check for understanding with an exit prompt.",
      ],
    },
  ];

  const workedExamples =
    input.subjectKey.includes("math") || input.subjectKey.includes("mathematics")
      ? [
          `Example 1: Solve a basic problem involving ${keywords[0] ?? topic}.`,
          `Example 2: Apply ${keywords[1] ?? "the concept"} to a word problem.`,
        ]
      : [];

  const practice = {
    easy: [
      `Identify examples of ${keywords[0] ?? topic}.`,
      `Match key terms to short definitions.`,
    ],
    medium: [
      `Explain ${keywords[1] ?? topic} in your own words.`,
      `Complete a guided practice activity.`,
    ],
    hard: [
      `Solve a real-world problem using ${keywords[2] ?? topic}.`,
      `Compare two ideas from the lesson and justify your answer.`,
    ],
  };

  const quiz = generateQuiz(`${summary} ${lessonNotes.map((note) => note.bullets.join(" ")).join(" ")}`, input.grade);

  return {
    title: topic,
    topic,
    summary,
    learningOutcomes,
    lessonNotes,
    workedExamples,
    practice,
    quiz,
    memo: buildMemoFromQuiz(quiz),
    teacherNotes: [
      "Keep explanations short and use visuals where possible.",
      "Encourage learners to explain answers in their own words.",
    ],
    citations,
  };
}

function normalizeLessonNotes(value: any): LessonNoteSection[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((section) => {
      if (!section || typeof section !== "object") return null;
      const title = asNonEmptyString((section as any).title);
      const bullets = asStringArray((section as any).bullets ?? (section as any).content);
      if (!title || bullets.length === 0) return null;
      return { title, bullets };
    })
    .filter(Boolean) as LessonNoteSection[];
}

function validateQuiz(quiz: Quiz) {
  const parsed = QuizSchema.parse(quiz);
  for (const question of parsed.questions) {
    if (question.type === "mcq") {
      if (!question.options || question.options.length < 3) {
        throw new Error(`MCQ question ${question.id} missing options.`);
      }
      const match = question.options.find(
        (option: any) => option.toLowerCase().trim() === question.answer.toLowerCase().trim()
      );
      if (!match) {
        throw new Error(`MCQ question ${question.id} answer not in options.`);
      }
    }
    if (question.type === "true_false") {
      const normalized = question.answer.toLowerCase().trim();
      if (normalized !== "true" && normalized !== "false") {
        throw new Error(`True/false question ${question.id} has invalid answer.`);
      }
    }
  }
  if (parsed.questions.length < 6 || parsed.questions.length > 10) {
    throw new Error("Quiz must include 6 to 10 questions.");
  }
  return parsed;
}

function buildCitations(chunks: RagChunkScore[], fallbackNote: string) {
  if (!chunks.length) {
    return [
      {
        file_path: "content/caps_scaffold.json",
        page_start: 1,
        page_end: 1,
        note: fallbackNote,
      },
    ];
  }
  const grouped = new Map<string, { pages: Set<string>; note?: string }>();
  for (const chunk of chunks) {
    const entry = grouped.get(chunk.file_path) ?? { pages: new Set<string>() };
    entry.pages.add(`${chunk.page_start}-${chunk.page_end}`);
    if (chunk.doc_type) {
      entry.note = entry.note ? `${entry.note}, ${chunk.doc_type}` : `doc_type: ${chunk.doc_type}`;
    }
    grouped.set(chunk.file_path, entry);
  }

  return Array.from(grouped.entries()).map(([file_path, entry]) => {
    const pageRanges = Array.from(entry.pages).map((range) => range.split("-").map(Number));
    const sorted = pageRanges.sort((a, b) => a[0] - b[0]);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return {
      file_path,
      page_start: first ? first[0] : 1,
      page_end: last ? last[1] ?? last[0] : 1,
      note: entry.note,
    };
  });
}

export async function generateAiLesson(
  input: GenerateAiLessonInput,
  options: GenerateAiLessonOptions = {}
): Promise<GeneratedAiLessonResult> {
  if (!Number.isFinite(input.grade) || input.grade < 0 || input.grade > 12) {
    throw new Error("Invalid grade.");
  }
  if (!Number.isFinite(input.term) || input.term < 1 || input.term > 4) {
    throw new Error("Invalid term.");
  }
  if (!Number.isFinite(input.week) || input.week < 1) {
    throw new Error("Invalid week.");
  }

  const scaffold = loadCapsScaffold();
  const weekInfo = findWeekInScaffold(scaffold, input);

  const indexPath = findRagIndexPath();
  const chunks = indexPath
    ? await retrieveChunks({
        phase: input.phase,
        grade: input.grade,
        subjectKey: input.subjectKey,
        term: input.term,
        week: input.week,
        topic: input.topic ?? weekInfo?.topic_title,
        k: options.k ?? 12,
        indexPath,
      })
    : [];

  const citations = buildCitations(chunks, "caps_scaffold reference");
  const combinedText = [
    weekInfo?.summary_md ?? "",
    weekInfo?.topic_title ?? "",
    ...chunks.map((chunk: any) => chunk.text),
  ]
    .join(" ")
    .trim();

  let usedModel = false;
  let parsed: any = null;

  const prompt = buildPrompt(input, weekInfo, chunks, false);
  const response = await callChatModel(prompt, options);

  if (response) {
    usedModel = true;
    parsed = extractJson(response);
    const outputText = JSON.stringify(parsed);
    if (chunks.length && hasLongOverlap(outputText, chunks.map((chunk: any) => chunk.text), 20)) {
      const retryPrompt = buildPrompt(input, weekInfo, chunks, true);
      const retryResponse = await callChatModel(retryPrompt, options);
      if (!retryResponse) {
        throw new Error("Model retry failed.");
      }
      parsed = extractJson(retryResponse);
      const retryText = JSON.stringify(parsed);
      if (hasLongOverlap(retryText, chunks.map((chunk: any) => chunk.text), 20)) {
        throw new Error("Generated content overlaps too closely with sources.");
      }
    }
  } else {
    parsed = null;
  }

  const fallback = buildFallbackLesson(input, weekInfo, combinedText, citations);

  const title = asNonEmptyString(parsed?.title) || asNonEmptyString(parsed?.topic) || fallback.title;
  const topic = asNonEmptyString(parsed?.topic) || title;
  const summary = asNonEmptyString(parsed?.summary) || fallback.summary;
  const learningOutcomes = asStringArray(parsed?.learningOutcomes ?? parsed?.learning_outcomes);
  const lessonNotes = normalizeLessonNotes(parsed?.lessonNotes ?? parsed?.lesson_notes);
  const workedExamples = asStringArray(parsed?.workedExamples ?? parsed?.worked_examples);
  const practice =
    parsed?.practice && typeof parsed.practice === "object"
      ? {
          easy: asStringArray(parsed.practice.easy),
          medium: asStringArray(parsed.practice.medium),
          hard: asStringArray(parsed.practice.hard),
        }
      : fallback.practice;

  let quiz: Quiz = fallback.quiz;
  if (parsed?.quiz) {
    try {
      quiz = validateQuiz(parsed.quiz);
    } catch {
      quiz = fallback.quiz;
    }
  }

  const questions = quiz.questions;
  if (questions.length > 10) {
    quiz.questions = questions.slice(0, 10);
  }
  if (quiz.questions.length < 6) {
    const supplement = generateQuiz(combinedText || summary, input.grade);
    while (quiz.questions.length < 6 && supplement.questions.length) {
      quiz.questions.push(supplement.questions.shift() as QuizQuestion);
    }
  }

  const memo = buildMemoFromQuiz(quiz);

  const teacherNotes = asStringArray(parsed?.teacherNotes ?? parsed?.teacher_notes);

  const finalLesson: GeneratedLessonContent = {
    title,
    topic,
    summary,
    learningOutcomes: learningOutcomes.length ? learningOutcomes : fallback.learningOutcomes,
    lessonNotes: lessonNotes.length ? lessonNotes : fallback.lessonNotes,
    workedExamples: workedExamples.length ? workedExamples : fallback.workedExamples,
    practice: {
      easy: practice.easy.length ? practice.easy : fallback.practice.easy,
      medium: practice.medium.length ? practice.medium : fallback.practice.medium,
      hard: practice.hard.length ? practice.hard : fallback.practice.hard,
    },
    quiz,
    memo,
    teacherNotes: teacherNotes.length ? teacherNotes : fallback.teacherNotes,
    citations,
  };

  if (!finalLesson.lessonNotes.length || !finalLesson.learningOutcomes.length) {
    throw new Error("Generated lesson is missing required sections.");
  }
  if (!finalLesson.citations.length) {
    throw new Error("Generated lesson is missing citations.");
  }
  validateQuiz(finalLesson.quiz);

  return { content: finalLesson, usedChunks: chunks, usedModel };
}

function findWeekInScaffold(scaffold: ReturnType<typeof loadCapsScaffold>, input: GenerateAiLessonInput) {
  const phase = scaffold.phases?.[input.phase];
  const gradeKey = input.grade === 0 ? "R" : String(input.grade);
  const grade = phase?.grades?.[gradeKey];
  if (!grade) return null;
  for (const group of Object.values(grade.groups ?? {}) as any[]) {
    const subject = group.subjects?.[input.subjectKey];
    if (subject?.terms) {
      const termKey = Object.keys(subject.terms).find((key) => key.includes(String(input.term)));
      if (!termKey) continue;
      const term = subject.terms[termKey];
      if (!term?.weeks?.length) continue;
      return term.weeks[input.week - 1] ?? null;
    }
    if (subject?.children) {
      for (const child of Object.values(subject.children) as any[]) {
        if (!child.terms) continue;
        const termKey = Object.keys(child.terms).find((key) => key.includes(String(input.term)));
        if (!termKey) continue;
        const term = child.terms[termKey];
        if (!term?.weeks?.length) continue;
        const week = term.weeks[input.week - 1] ?? null;
        if (week) return week;
      }
    }

    for (const parent of Object.values(group.subjects ?? {}) as any[]) {
      if (!parent?.children) continue;
      const child = parent.children?.[input.subjectKey];
      if (!child?.terms) continue;
      const termKey = Object.keys(child.terms).find((key) => key.includes(String(input.term)));
      if (!termKey) continue;
      const term = child.terms[termKey];
      if (!term?.weeks?.length) continue;
      const week = term.weeks[input.week - 1] ?? null;
      if (week) return week;
    }
  }
  return null;
}
