import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { LessonV1Schema, type LessonV1 } from "../generated-lessons-v1.js";

export type UniversityGenerateInput = {
  institution: string;
  faculty: string;
  course: string;
  yearOfStudy: number;
  moduleCode: string;
  moduleName?: string;
  topic?: string;
  transcriptText?: string;
  topK?: number;
  force?: boolean;
};

export type UniversityGenerateOptions = {
  apiKey?: string;
  apiBase?: string;
  model?: string;
};

export type UniversityGenerateResult = {
  lesson: LessonV1;
  usedModel: string;
  promptHash: string;
};

type LessonCitation = {
  source_path: string;
  page_start: number;
  page_end: number;
  snippet_hash: string;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function pad2(value: number) {
  return String(Math.max(0, Math.round(value))).padStart(2, "0");
}

function findRepoRoot() {
  const cwd = process.cwd();
  const candidates = [cwd, path.join(cwd, ".."), path.join(cwd, "..", "..")];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "content"))) return candidate;
  }
  return cwd;
}

function getApiConfig(options: UniversityGenerateOptions) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY.");
  const apiBase = options.apiBase || process.env.OPENAI_API_BASE || "https://api.openai.com/v1";
  const model = options.model || process.env.OPENAI_MODEL || "gpt-4o-mini";
  return { apiKey, apiBase, model };
}

async function callChatModel(prompt: string, options: UniversityGenerateOptions) {
  const { apiKey, apiBase, model } = getApiConfig(options);
  const response = await fetch(`${apiBase.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a university-level academic content author. Produce original, academically rigorous content. Never copy source text verbatim. Use precise terminology appropriate for undergraduate study.",
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
  if (!content) throw new Error("LLM response missing content.");
  return { text: String(content).trim(), model: data?.model || model };
}

function extractJson(payload: string) {
  try {
    return JSON.parse(payload);
  } catch {
    const start = payload.indexOf("{");
    const end = payload.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(payload.slice(start, end + 1));
    throw new Error("Failed to parse JSON from LLM response.");
  }
}

function normalizeWords(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);
}

function hasLongOverlap(output: string, sources: string[], n = 20, maxMatches = 1) {
  const outputTokens = normalizeWords(output);
  if (outputTokens.length < n) return false;
  const sourceNgrams = new Set<string>();
  for (const source of sources) {
    const tokens = normalizeWords(source).slice(0, 3000);
    for (let i = 0; i <= tokens.length - n; i += 1) {
      sourceNgrams.add(tokens.slice(i, i + n).join(" "));
    }
  }
  let matches = 0;
  for (let i = 0; i <= outputTokens.length - n; i += 1) {
    const key = outputTokens.slice(i, i + n).join(" ");
    if (sourceNgrams.has(key)) {
      if (++matches > maxMatches) return true;
    }
  }
  return false;
}

function buildPrompt(input: UniversityGenerateInput) {
  const moduleLabel = input.moduleName
    ? `${input.moduleCode} — ${input.moduleName}`
    : input.moduleCode;

  const transcriptSection = input.transcriptText
    ? `\nVideo transcript for additional context:\n${input.transcriptText.slice(0, 4000)}`
    : "";

  return [
    `Create an original undergraduate-level study guide for module ${moduleLabel}.`,
    `Institution: ${input.institution}`,
    `Faculty: ${input.faculty}`,
    `Degree / Course: ${input.course}, Year ${input.yearOfStudy}`,
    input.topic ? `Focus topic: ${input.topic}` : "",
    "",
    "This is NOT a school lesson. Write at a rigorous academic level with formal terminology.",
    "Include real-world examples, critical analysis, and exam-style practice questions.",
    transcriptSection,
    "",
    "Return ONLY valid JSON with this exact shape:",
    "{",
    '  "title": string,',
    '  "summary": string,',
    '  "objectives": string[],',
    '  "sections": {',
    '    "explanation": [{ "heading": string, "content": string }],',
    '    "worked_examples": [{ "heading": string, "content": string }],',
    '    "guided_practice": [{ "heading": string, "content": string }],',
    '    "independent_practice": [{ "heading": string, "content": string }]',
    "  },",
    '  "quiz": {',
    '    "questions": [',
    '      { "id": string, "type": "mcq"|"short_answer", "prompt": string,',
    '        "options"?: string[], "answer": string, "explanation": string }',
    "    ]",
    "  },",
    '  "citations": [',
    '    { "source_path": string, "page_start": number, "page_end": number, "snippet_hash": string }',
    "  ]",
    "}",
    "",
    "Requirements:",
    "- At least 2 explanation sections covering theory and key concepts",
    "- At least 2 worked examples (case studies, solved problems, or applied scenarios)",
    "- At least 2 guided practice items (structured exercises with scaffolding)",
    "- At least 2 independent practice items (exam-style questions without hints)",
    "- At least 8 quiz questions: minimum 5 MCQ (4 options each) and 3 short-answer",
    "- Citations must reference the module code as source_path with page numbers 1-10",
    "- All quiz question IDs must be unique strings",
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

function syntheticCitation(input: UniversityGenerateInput): LessonCitation {
  const ref = `${input.institution}/${input.faculty}/${input.course}/${input.moduleCode}`;
  return {
    source_path: ref,
    page_start: 1,
    page_end: 1,
    snippet_hash: createHash("sha256").update(ref).digest("hex"),
  };
}

export function getUniversityLessonOutputPaths(input: UniversityGenerateInput) {
  const repoRoot = findRepoRoot();
  const baseDir = path.join(
    repoRoot,
    "content",
    "university-lessons",
    slugify(input.institution),
    slugify(input.faculty),
    slugify(input.course),
    `year-${pad2(input.yearOfStudy)}`,
    slugify(input.moduleCode)
  );
  return {
    baseDir,
    lessonPath: path.join(baseDir, "lesson.json"),
    generationPath: path.join(baseDir, "generation.md"),
  };
}

export async function generateUniversityModuleLesson(
  input: UniversityGenerateInput,
  options: UniversityGenerateOptions = {}
): Promise<UniversityGenerateResult> {
  if (!input.institution?.trim()) throw new Error("institution is required");
  if (!input.faculty?.trim()) throw new Error("faculty is required");
  if (!input.course?.trim()) throw new Error("course is required");
  if (!input.moduleCode?.trim()) throw new Error("moduleCode is required");
  if (!Number.isFinite(input.yearOfStudy) || input.yearOfStudy < 1) {
    throw new Error("yearOfStudy must be a positive integer");
  }

  const prompt = buildPrompt(input);
  const promptHash = createHash("sha256").update(prompt).digest("hex");

  let response = await callChatModel(prompt, options);
  let parsed = extractJson(response.text);

  if (hasLongOverlap(JSON.stringify(parsed), [prompt])) {
    const stricterPrompt = `${prompt}\n\nRewrite with stronger paraphrasing and zero verbatim copying from the instructions.`;
    response = await callChatModel(stricterPrompt, options);
    parsed = extractJson(response.text);
  }

  if (!Array.isArray(parsed.citations) || parsed.citations.length === 0) {
    parsed.citations = [syntheticCitation(input)];
  }

  const normalized = LessonV1Schema.parse(parsed);
  if (normalized.quiz.questions.length < 8) {
    throw new Error("Quiz must include at least 8 questions.");
  }

  return { lesson: normalized, usedModel: response.model, promptHash };
}

export function writeUniversityLessonFiles(params: {
  input: UniversityGenerateInput;
  result: UniversityGenerateResult;
}) {
  const paths = getUniversityLessonOutputPaths(params.input);
  fs.mkdirSync(paths.baseDir, { recursive: true });
  fs.writeFileSync(paths.lessonPath, JSON.stringify(params.result.lesson, null, 2));

  const report = [
    "# University Module Lesson Generation Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Model: ${params.result.usedModel}`,
    `Prompt hash: ${params.result.promptHash}`,
    `Institution: ${params.input.institution}`,
    `Faculty: ${params.input.faculty}`,
    `Course: ${params.input.course}`,
    `Year: ${params.input.yearOfStudy}`,
    `Module: ${params.input.moduleCode}`,
    params.input.topic ? `Topic: ${params.input.topic}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  fs.writeFileSync(paths.generationPath, report);
  return paths;
}
