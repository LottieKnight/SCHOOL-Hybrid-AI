import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  LessonSchema,
  QuizSchema,
  type LessonContent,
  getLessonJsonPath,
  normalizeSubjectDir,
} from "./lesson-content.js";
import { generateQuiz } from "./quiz-generator.js";
import { retrieveChunks, type ContentChunk } from "./retrieval.js";

export type GenerateLessonInput = {
  phase?: "foundation" | "intermediate" | "senior" | "fet";
  grade: number;
  subject: string;
  term: number;
  week: number;
  topic?: string;
  topK?: number;
};

export type GenerateLessonOptions = {
  indexPath?: string;
  apiKey?: string;
  apiBase?: string;
  model?: string;
  maxSourceChars?: number;
};

export type GenerateLessonResult = {
  lesson: LessonContent;
  filePath: string;
  usedChunks: ContentChunk[];
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function gradeToPhase(grade: number): GenerateLessonInput["phase"] {
  if (grade <= 3) return "foundation";
  if (grade <= 6) return "intermediate";
  if (grade <= 9) return "senior";
  return "fet";
}

function buildQuery(input: GenerateLessonInput) {
  const parts = [
    input.phase ?? gradeToPhase(input.grade),
    `grade ${input.grade}`,
    input.subject,
    `term ${input.term}`,
    `week ${input.week}`,
  ];
  if (input.topic) parts.push(input.topic);
  return parts.join(" ");
}

function normalizePath(value: string) {
  return value.split(path.sep).join("/");
}

function toPdfRelativePath(filePath: string) {
  const normalized = normalizePath(filePath);
  const marker = "content/pdf/";
  const index = normalized.indexOf(marker);
  if (index >= 0) {
    return normalized.slice(index + marker.length);
  }
  return normalized;
}

function buildResources(chunks: ContentChunk[]) {
  const grouped = new Map<string, { title: string; pages: string[] }>();
  for (const chunk of chunks) {
    const relPath = toPdfRelativePath(chunk.file_path);
    const title = path.basename(relPath);
    const entry = grouped.get(relPath) ?? { title, pages: [] };
    entry.pages.push(chunk.pages);
    grouped.set(relPath, entry);
  }

  return Array.from(grouped.entries()).map(([sourcePdfPath, entry]) => {
    const pageRefs = entry.pages
      .slice()
      .sort((a, b) => {
        const aNum = Number(a.split("-")[0]);
        const bNum = Number(b.split("-")[0]);
        if (!Number.isFinite(aNum) || !Number.isFinite(bNum)) return a.localeCompare(b);
        return aNum - bNum;
      })
      .join(", ");
    return {
      title: entry.title,
      sourcePdfPath,
      pageRefs: pageRefs || undefined,
    };
  });
}

function splitSentences(text: string) {
  return text
    .replace(/\r/g, " ")
    .replace(/\n+/g, " ")
    .split(/(?<=[.?!])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function fallbackBullets(text: string, limit: number) {
  const sentences = splitSentences(text);
  return sentences.slice(0, limit);
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

function hashSource(chunk: ContentChunk) {
  return createHash("sha256")
    .update(`${chunk.file_path}|${chunk.pages}|${chunk.text}`)
    .digest("hex");
}

function getApiConfig(options: GenerateLessonOptions) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY (or LLM_API_KEY). Set it in your environment.");
  }
  const apiBase = options.apiBase || process.env.OPENAI_API_BASE || process.env.LLM_API_BASE || "https://api.openai.com/v1";
  const model = options.model || process.env.OPENAI_MODEL || process.env.LLM_MODEL || "gpt-4o-mini";
  return { apiKey, apiBase, model };
}

async function callChatModel(prompt: string, options: GenerateLessonOptions) {
  const { apiKey, apiBase, model } = getApiConfig(options);
  const response = await fetch(`${apiBase.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are a curriculum author. Produce original lesson content and never copy source text verbatim.",
        },
        {
          role: "user",
          content: prompt,
        },
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

function extractJson(payload: string) {
  try {
    return JSON.parse(payload);
  } catch {
    const start = payload.indexOf("{");
    const end = payload.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const slice = payload.slice(start, end + 1);
      return JSON.parse(slice);
    }
    throw new Error("Failed to parse JSON from LLM response.");
  }
}

function normalizeWords(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function hasLongOverlap(output: string, sources: string[], n = 12, maxMatches = 2) {
  const outputTokens = normalizeWords(output);
  if (outputTokens.length < n) return false;
  const sourceNgrams = new Set<string>();
  for (const source of sources) {
    const tokens = normalizeWords(source).slice(0, 2000);
    for (let i = 0; i <= tokens.length - n; i += 1) {
      sourceNgrams.add(tokens.slice(i, i + n).join(" "));
    }
  }

  let matches = 0;
  for (let i = 0; i <= outputTokens.length - n; i += 1) {
    const key = outputTokens.slice(i, i + n).join(" ");
    if (sourceNgrams.has(key)) {
      matches += 1;
      if (matches > maxMatches) return true;
    }
  }
  return false;
}

export async function generateWeekLesson(
  input: GenerateLessonInput,
  options: GenerateLessonOptions = {}
): Promise<GenerateLessonResult> {
  if (!Number.isFinite(input.grade) || input.grade < 0 || input.grade > 12) {
    throw new Error("Invalid grade.");
  }
  if (!Number.isFinite(input.term) || input.term < 1 || input.term > 4) {
    throw new Error("Invalid term.");
  }
  if (!Number.isFinite(input.week) || input.week < 1) {
    throw new Error("Invalid week.");
  }
  if (!input.subject || !input.subject.trim()) {
    throw new Error("Subject is required.");
  }

  const phase =
    input.phase && ["foundation", "intermediate", "senior", "fet"].includes(input.phase)
      ? input.phase
      : gradeToPhase(input.grade);
  const subjectKey = normalizeSubjectDir(input.subject);
  if (!subjectKey) {
    throw new Error("Subject could not be normalized.");
  }
  const query = buildQuery({ ...input, phase, subject: subjectKey });
  let usedChunks = await retrieveChunks(query, {
    topK: input.topK ?? 8,
    indexPath: options.indexPath,
    filters: { grade: input.grade, term: input.term, subject: subjectKey },
  });
  if (!usedChunks.length) {
    usedChunks = await retrieveChunks(query, {
      topK: input.topK ?? 8,
      indexPath: options.indexPath,
    });
  }
  if (!usedChunks.length) {
    throw new Error("No matching chunks found. Build chunks or adjust query.");
  }

  const maxSourceChars = options.maxSourceChars ?? 1800;
  const sources = usedChunks.map((chunk: ContentChunk, idx: number) => {
    const snippet = chunk.text.replace(/\s+/g, " ").trim().slice(0, maxSourceChars);
    return `Source ${idx + 1}: ${chunk.file_path} (pages ${chunk.pages})\n${snippet}`;
  });

  const prompt = [
    `Create an original, age-appropriate lesson for ${phase} phase, grade ${input.grade}, subject ${subjectKey}, term ${input.term}, week ${input.week}.`,
    input.topic ? `Topic focus: ${input.topic}.` : "",
    "Use the sources below for grounding, but do NOT copy sentences verbatim. Paraphrase and synthesize.",
    "Return ONLY valid JSON with these fields:",
    "- title (string)",
    "- topic (string)",
    "- summary (string)",
    "- outcomes (array of strings)",
    "- explanation (string)",
    "- workedExamples (array of strings)",
    "- practice: { easy: string[], medium: string[], hard: string[] }",
    "- lessonOutline (array of strings)",
    "- activities (array of strings)",
    "- assessment (array of strings)",
    "- quiz: { questions: [{ id, type, prompt, options?, answer, explanation, difficulty, tags }] }",
    "- memo (array of strings)",
    "- teacherNotes (array of strings)",
    "",
    "Quiz requirements:",
    "- 6 to 10 questions",
    "- type is one of: mcq, true_false, short_answer",
    "- options only for mcq (3 to 5 options)",
    "- include answer and explanation for every question",
    "",
    "Sources:",
    sources.join("\n\n"),
  ]
    .filter(Boolean)
    .join("\n");

  const response = await callChatModel(prompt, options);
  const parsed = extractJson(response);
  const outputText = JSON.stringify(parsed);
  if (hasLongOverlap(outputText, usedChunks.map((chunk: ContentChunk) => chunk.text))) {
    throw new Error("Generated content appears to copy source text. Re-run with a new prompt.");
  }

  const extractedText = usedChunks.map((chunk: ContentChunk) => chunk.text).join("\n\n").trim();
  const resources = buildResources(usedChunks);

  let quiz = generateQuiz(extractedText, input.grade);
  if (parsed.quiz) {
    try {
      quiz = QuizSchema.parse(parsed.quiz);
    } catch {
      quiz = generateQuiz(extractedText, input.grade);
    }
  }

  if (Array.isArray(quiz.questions) && quiz.questions.length > 10) {
    quiz.questions = quiz.questions.slice(0, 10);
  }
  if (Array.isArray(quiz.questions) && quiz.questions.length < 6) {
    const fallback = generateQuiz(extractedText, input.grade);
    while (quiz.questions.length < 6 && fallback.questions.length) {
      quiz.questions.push(fallback.questions.shift()!);
    }
  }

  const lessonOutlineSource = asStringArray(parsed.lessonOutline);
  const lessonOutline =
    lessonOutlineSource.length > 0
      ? lessonOutlineSource
      : fallbackBullets(parsed.explanation || extractedText, 6);

  const activitiesSource = asStringArray(parsed.activities);
  const activities = activitiesSource.length > 0 ? activitiesSource : fallbackBullets(extractedText, 5);

  const assessmentSource = asStringArray(parsed.assessment);
  const assessment = assessmentSource.length > 0 ? assessmentSource : fallbackBullets(extractedText, 4);

  const practice =
    parsed.practice && typeof parsed.practice === "object"
      ? {
          easy: asStringArray(parsed.practice.easy),
          medium: asStringArray(parsed.practice.medium),
          hard: asStringArray(parsed.practice.hard),
        }
      : { easy: [], medium: [], hard: [] };

  const outcomes = asStringArray(parsed.outcomes);
  const workedExamples = asStringArray(parsed.workedExamples);
  const memo = asStringArray(parsed.memo);
  const teacherNotes = asStringArray(parsed.teacherNotes);

  const title =
    asNonEmptyString(parsed.title) ||
    asNonEmptyString(parsed.topic) ||
    `${subjectKey} week ${pad2(input.week)}`;
  const topic = asNonEmptyString(parsed.topic) || title;
  const summary =
    asNonEmptyString(parsed.summary) || lessonOutline.slice(0, 2).join(" ") || extractedText.slice(0, 180);
  const explanation = asNonEmptyString(parsed.explanation);

  const lesson: LessonContent = LessonSchema.parse({
    version: 2,
    grade: input.grade,
    phase,
    term: input.term,
    week: input.week,
    subject: subjectKey,
    title,
    topic,
    summary,
    outcomes: outcomes.length ? outcomes : undefined,
    explanation: explanation ?? undefined,
    workedExamples: workedExamples.length ? workedExamples : undefined,
    practice,
    lessonOutline,
    activities,
    assessment,
    resources,
    extractedText: extractedText || lessonOutline.join(" "),
    quiz,
    memo: memo.length ? memo : undefined,
    teacherNotes: teacherNotes.length ? teacherNotes : undefined,
    sourceHashes: usedChunks.map(hashSource),
  });

  const lessonPath = getLessonJsonPath({
    gradeKey: String(input.grade),
    subjectKey: subjectKey,
    termKey: `term-${pad2(input.term)}`,
    weekNumber: input.week,
  });

  if (!lessonPath) {
    throw new Error("Failed to resolve lesson output path.");
  }

  await fs.mkdir(path.dirname(lessonPath), { recursive: true });
  await fs.writeFile(lessonPath, JSON.stringify(lesson, null, 2));

  return { lesson, filePath: lessonPath, usedChunks };
}
