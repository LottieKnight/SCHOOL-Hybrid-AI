import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { LessonV1Schema } from "../generated-lessons-v1.js";
import { retrieveRagV1Chunks } from "./retrieval.js";
function pad2(value) {
    return String(value).padStart(2, "0");
}
function findRepoRoot() {
    const cwd = process.cwd();
    const candidates = [cwd, path.join(cwd, ".."), path.join(cwd, "..", "..")];
    for (const candidate of candidates) {
        if (fs.existsSync(path.join(candidate, "content"))) {
            return candidate;
        }
    }
    return cwd;
}
function getApiConfig(options) {
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error("Missing OPENAI_API_KEY. Set it in apps/web/.env.local.");
    }
    const apiBase = options.apiBase || process.env.OPENAI_API_BASE || "https://api.openai.com/v1";
    const model = options.model || process.env.OPENAI_MODEL || "gpt-4o-mini";
    return { apiKey, apiBase, model };
}
async function callChatModel(prompt, options) {
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
                    content: "You are a CAPS-aligned lesson author. Produce original content and never copy source text verbatim.",
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
    const data = (await response.json());
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error("LLM response missing content.");
    }
    return { text: String(content).trim(), model: data?.model || model };
}
function extractJson(payload) {
    try {
        return JSON.parse(payload);
    }
    catch {
        const start = payload.indexOf("{");
        const end = payload.lastIndexOf("}");
        if (start >= 0 && end > start) {
            return JSON.parse(payload.slice(start, end + 1));
        }
        throw new Error("Failed to parse JSON from LLM response.");
    }
}
function normalizeWords(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 2);
}
function hasLongOverlap(output, sources, n = 20, maxMatches = 1) {
    const outputTokens = normalizeWords(output);
    if (outputTokens.length < n)
        return false;
    const sourceNgrams = new Set();
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
            matches += 1;
            if (matches > maxMatches)
                return true;
        }
    }
    return false;
}
function buildCitations(chunks) {
    return chunks.map((chunk) => ({
        source_path: chunk.file_path,
        page_start: chunk.page_start,
        page_end: chunk.page_end,
        snippet_hash: createHash("sha256")
            .update(chunk.text.replace(/\s+/g, " ").trim())
            .digest("hex"),
    }));
}
function computePromptHash(prompt) {
    return createHash("sha256").update(prompt).digest("hex");
}
function buildPrompt(input, chunks) {
    const sources = chunks.map((chunk, idx) => {
        const snippet = chunk.text.replace(/\s+/g, " ").trim().slice(0, 1800);
        return `Source ${idx + 1}: ${chunk.file_path} (pages ${chunk.page_start}-${chunk.page_end})\n${snippet}`;
    });
    return [
        `Create an original CAPS-aligned lesson for ${input.phase} phase, grade ${input.grade}, subject ${input.subjectKey}, term ${input.term}, week ${input.week}.`,
        input.topic ? `Topic focus: ${input.topic}.` : "",
        "Use the sources below for grounding, but do NOT copy sentences verbatim.",
        "Return ONLY valid JSON with the following shape:",
        "{",
        "  title: string,",
        "  summary: string,",
        "  objectives: string[],",
        "  sections: {",
        "    explanation: [{ heading, content }],",
        "    worked_examples: [{ heading, content }],",
        "    guided_practice: [{ heading, content }],",
        "    independent_practice: [{ heading, content }]",
        "  },",
        "  quiz: { questions: [{ id, type, prompt, options?, answer, explanation }] },",
        "  teacher_notes?: string[],",
        "  citations: [{ source_path, page_start, page_end, snippet_hash }]",
        "}",
        "Quiz rules:",
        "- at least 8 questions",
        "- mix of mcq and short_answer",
        "- MCQ includes 3-5 options",
        "- include an answer + explanation for every question",
        "Citations should mirror the sources used (path + page range + snippet hash).",
        "",
        "Sources:",
        sources.join("\n\n"),
    ]
        .filter(Boolean)
        .join("\n");
}
export async function generateLessonV1(input, options = {}) {
    if (!Number.isFinite(input.grade) || input.grade < 0 || input.grade > 12) {
        throw new Error("Invalid grade.");
    }
    if (!Number.isFinite(input.term) || input.term < 1 || input.term > 4) {
        throw new Error("Invalid term.");
    }
    if (!Number.isFinite(input.week) || input.week < 1) {
        throw new Error("Invalid week.");
    }
    if (!input.subjectKey || !input.subjectKey.trim()) {
        throw new Error("Subject is required.");
    }
    const usedChunks = await retrieveRagV1Chunks({
        phase: input.phase,
        grade: input.grade,
        subjectKey: input.subjectKey,
        term: input.term,
        week: input.week,
        topic: input.topic,
        k: input.topK ?? 12,
        indexPath: options.indexPath,
    });
    if (!usedChunks.length) {
        throw new Error("No matching chunks found. Build the RAG v1 index first.");
    }
    const prompt = buildPrompt(input, usedChunks);
    const promptHash = computePromptHash(prompt);
    const sources = usedChunks.map((chunk) => chunk.text);
    let response = await callChatModel(prompt, options);
    let parsed = extractJson(response.text);
    const rawOutput = JSON.stringify(parsed);
    if (hasLongOverlap(rawOutput, sources)) {
        const stricterPrompt = `${prompt}\n\nRewrite with stronger paraphrasing and zero verbatim copying.`;
        response = await callChatModel(stricterPrompt, options);
        parsed = extractJson(response.text);
        if (hasLongOverlap(JSON.stringify(parsed), sources)) {
            throw new Error("Generated content appears to copy source text. Aborting.");
        }
    }
    const citations = buildCitations(usedChunks);
    parsed.citations = citations;
    const normalized = LessonV1Schema.parse(parsed);
    if (normalized.quiz.questions.length < 8) {
        throw new Error("Quiz must include at least 8 questions.");
    }
    const hasMcq = normalized.quiz.questions.some((q) => q.type === "mcq");
    const hasShort = normalized.quiz.questions.some((q) => q.type === "short_answer");
    if (!hasMcq || !hasShort) {
        throw new Error("Quiz must include a mix of MCQ and short-answer questions.");
    }
    return {
        lesson: normalized,
        citations,
        usedChunks,
        usedModel: response.model,
        promptHash,
    };
}
export function getGeneratedLessonOutputPaths(input) {
    const gradeDir = `grade-${pad2(input.grade)}`;
    const termDir = `term-${pad2(input.term)}`;
    const weekDir = `week-${pad2(input.week)}`;
    const subjectDir = input.subjectKey.trim().toLowerCase();
    const repoRoot = findRepoRoot();
    const root = path.join(repoRoot, "content", "generated_lessons", "v1");
    const baseDir = path.join(root, input.phase, gradeDir, subjectDir, termDir, weekDir);
    return {
        baseDir,
        lessonPath: path.join(baseDir, "lesson.json"),
        sourcesPath: path.join(baseDir, "sources.json"),
        generationPath: path.join(baseDir, "generation.md"),
    };
}
export function writeGeneratedLessonFiles(params) {
    const paths = getGeneratedLessonOutputPaths(params.input);
    fs.mkdirSync(paths.baseDir, { recursive: true });
    fs.writeFileSync(paths.lessonPath, JSON.stringify(params.result.lesson, null, 2));
    fs.writeFileSync(paths.sourcesPath, JSON.stringify({
        citations: params.result.citations,
        sources: params.result.usedChunks.map((chunk) => ({
            file_path: chunk.file_path,
            page_start: chunk.page_start,
            page_end: chunk.page_end,
            score: chunk.score,
        })),
    }, null, 2));
    const generatedAt = new Date().toISOString();
    const reportLines = [
        "# Lesson Generation Report (v1)",
        "",
        `Generated: ${generatedAt}`,
        `Model: ${params.result.usedModel}`,
        `Prompt hash: ${params.result.promptHash}`,
        `Phase: ${params.input.phase}`,
        `Grade: ${params.input.grade}`,
        `Subject: ${params.input.subjectKey}`,
        `Term: ${params.input.term}`,
        `Week: ${params.input.week}`,
        params.input.topic ? `Topic: ${params.input.topic}` : "",
        "",
        `Chunks used: ${params.result.usedChunks.length}`,
    ].filter(Boolean);
    fs.writeFileSync(paths.generationPath, reportLines.join("\n"));
    return paths;
}
