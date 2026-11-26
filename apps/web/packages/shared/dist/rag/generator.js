import { createHash } from "node:crypto";
import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { LessonSchema, QuizSchema, getLessonJsonPath, normalizeSubjectDir, } from "../lesson-content.js";
import { generateQuiz } from "../quiz-generator.js";
import { retrieveChunks } from "./retrieval.js";
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
function pad2(value) {
    return String(value).padStart(2, "0");
}
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
function gradeToPhase(grade) {
    if (grade <= 3)
        return "foundation";
    if (grade <= 6)
        return "intermediate";
    if (grade <= 9)
        return "senior";
    return "fet";
}
function normalizeText(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
}
function tokenize(text) {
    return normalizeText(text)
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 3 && !STOP_WORDS.has(token));
}
function topKeywords(text, limit) {
    const counts = new Map();
    for (const token of tokenize(text)) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
    }
    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([token]) => token)
        .slice(0, limit);
}
function splitSentences(text) {
    return text
        .replace(/\r/g, " ")
        .replace(/\n+/g, " ")
        .split(/(?<=[.?!])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);
}
function asStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .map((item) => (typeof item === "string" ? item : String(item)))
        .map((item) => item.trim())
        .filter(Boolean);
}
function asNonEmptyString(value) {
    if (typeof value !== "string")
        return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
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
        throw new Error("Failed to parse JSON from model response.");
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
function hasLongOverlap(output, sources, minWords = 20) {
    const outputTokens = normalizeWords(output);
    if (outputTokens.length < minWords)
        return false;
    const sourceNgrams = new Set();
    for (const source of sources) {
        const tokens = normalizeWords(source).slice(0, 2000);
        for (let i = 0; i <= tokens.length - minWords; i += 1) {
            sourceNgrams.add(tokens.slice(i, i + minWords).join(" "));
        }
    }
    for (let i = 0; i <= outputTokens.length - minWords; i += 1) {
        const key = outputTokens.slice(i, i + minWords).join(" ");
        if (sourceNgrams.has(key))
            return true;
    }
    return false;
}
function hashChunk(chunk) {
    return createHash("sha256")
        .update(`${chunk.file_path}|${chunk.page_start}-${chunk.page_end}|${chunk.text}`)
        .digest("hex");
}
function toSourcePdfPath(filePath) {
    const normalized = filePath.split(path.sep).join("/");
    if (normalized.startsWith("content/pdf/")) {
        return normalized.slice("content/pdf/".length);
    }
    if (normalized.startsWith("content/gde_lrip_mip_mirror/")) {
        return normalized.slice("content/".length);
    }
    return normalized;
}
function buildResources(chunks) {
    const grouped = new Map();
    for (const chunk of chunks) {
        const sourcePdfPath = toSourcePdfPath(chunk.file_path);
        const title = path.basename(sourcePdfPath);
        const entry = grouped.get(sourcePdfPath) ?? { title, pages: new Set(), docTypes: new Set() };
        entry.pages.add(`${chunk.page_start}-${chunk.page_end}`);
        if (chunk.doc_type) {
            entry.docTypes.add(chunk.doc_type);
        }
        grouped.set(sourcePdfPath, entry);
    }
    return Array.from(grouped.entries()).map(([sourcePdfPath, entry]) => {
        const pageRefs = Array.from(entry.pages)
            .sort((a, b) => {
            const aNum = Number(a.split("-")[0]);
            const bNum = Number(b.split("-")[0]);
            if (!Number.isFinite(aNum) || !Number.isFinite(bNum))
                return a.localeCompare(b);
            return aNum - bNum;
        })
            .map((range) => {
            const [start, end] = range.split("-");
            return start === end ? `p. ${start}` : `pp. ${start}-${end}`;
        })
            .join(", ");
        const note = entry.docTypes.size ? `doc_type: ${Array.from(entry.docTypes).join(", ")}` : undefined;
        return {
            title: entry.title,
            sourcePdfPath,
            pageRefs: pageRefs || undefined,
            note,
        };
    });
}
function buildFallbackLesson(input, chunks) {
    const combinedText = chunks.map((chunk) => chunk.text).join(" ");
    const keywords = topKeywords(combinedText, 8);
    const topic = input.topic || `${input.subjectKey.replace(/-/g, " ")} week ${input.week}`;
    const summary = `This lesson focuses on ${topic}. Key ideas include ${keywords.slice(0, 4).join(", ")}.`;
    const lessonOutline = [
        `Warm-up: introduce ${keywords[0] ?? "the topic"} with a quick discussion.`,
        `Teach: explain ${keywords.slice(0, 2).join(" and ") || "the core ideas"} using examples.`,
        `Guided practice: work through a short activity on ${keywords[2] ?? "the main concept"}.`,
        `Independent practice: learners apply ${keywords[3] ?? "the skill"} in pairs or individually.`,
        `Wrap-up: review ${keywords.slice(4, 6).join(" and ") || "the key points"}.`,
    ];
    const activities = [
        `Class brainstorm: list examples of ${keywords[0] ?? "the topic"} from daily life.`,
        `Pair work: create a short poster explaining ${keywords[1] ?? "one key idea"}.`,
        `Reflection: write 2-3 sentences about ${keywords[2] ?? "what was learned"}.`,
    ];
    const assessment = [
        `Exit ticket: define ${keywords[0] ?? "the main term"} in one sentence.`,
        `Short response: explain why ${keywords[3] ?? "the concept"} is important.`,
    ];
    const practice = {
        easy: [
            `Identify examples of ${keywords[0] ?? "the topic"} in a short text.`,
            `Match key terms to definitions (${keywords.slice(0, 3).join(", ")}).`,
        ],
        medium: [
            `Explain ${keywords[1] ?? "a key idea"} using your own words.`,
            `Complete a mini task applying ${keywords[2] ?? "the concept"}.`,
        ],
        hard: [
            `Solve a real-world problem using ${keywords[3] ?? "the concept"}.`,
            `Compare ${keywords[4] ?? "two ideas"} and justify your answer.`,
        ],
    };
    const workedExamples = input.subjectKey.includes("math") || input.subjectKey.includes("mathematics")
        ? [
            `Example 1: Apply ${keywords[0] ?? "the concept"} step-by-step with a simple number set.`,
            `Example 2: Solve a word problem that uses ${keywords[1] ?? "the skill"}.`,
        ]
        : [];
    const memo = [
        `Suggested answer: define ${keywords[0] ?? "the main term"} clearly and give an example.`,
        `Suggested answer: highlight ${keywords[1] ?? "the key idea"} and relate it to real life.`,
    ];
    const teacherNotes = [
        "Keep explanations short and use visuals where possible.",
        "Encourage learners to explain answers in their own words.",
    ];
    return {
        title: topic,
        topic,
        summary,
        learning_outcomes: [
            `Understand ${keywords[0] ?? "the main concept"}.`,
            `Apply ${keywords[1] ?? "key vocabulary"} in context.`,
            `Explain ${keywords[2] ?? "a core idea"} using examples.`,
        ],
        explanation: `Introduce ${topic} and connect it to learners' prior knowledge. Use examples related to ${keywords
            .slice(0, 3)
            .join(", ")}.`,
        worked_examples: workedExamples,
        lesson_outline: lessonOutline,
        activities,
        assessment,
        practice,
        quiz: null,
        memo,
        teacher_notes: teacherNotes,
    };
}
async function callChatModel(prompt, options) {
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
    if (!apiKey)
        return null;
    const apiBase = (options.apiBase || process.env.OPENAI_API_BASE || process.env.LLM_API_BASE || "https://api.openai.com/v1")
        .replace(/\/+$/, "");
    const model = options.model || process.env.OPENAI_MODEL || process.env.LLM_MODEL || "gpt-4o-mini";
    const response = await fetch(`${apiBase}/chat/completions`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model,
            temperature: 0.35,
            messages: [
                {
                    role: "system",
                    content: "You are a CAPS-aligned lesson author. Generate original prose and do not copy source sentences.",
                },
                { role: "user", content: prompt },
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
    return String(content).trim();
}
function buildPrompt(input, chunks, hardParaphrase) {
    const maxSourceChars = 1800;
    const sources = chunks.map((chunk, idx) => {
        const snippet = chunk.text.replace(/\s+/g, " ").trim().slice(0, maxSourceChars);
        return `Source ${idx + 1}: ${chunk.file_path} (pages ${chunk.page_start}-${chunk.page_end})\n${snippet}`;
    });
    return [
        `Create an original CAPS-aligned lesson for ${input.phase} phase, grade ${input.grade}, subject ${input.subjectKey}, term ${input.term}, week ${input.week}.`,
        input.topic ? `Topic focus: ${input.topic}.` : "",
        hardParaphrase
            ? "You MUST paraphrase aggressively. Do not reuse any 20-word sequence from sources."
            : "Use the sources only for grounding. Do not copy sentences verbatim.",
        "Return ONLY valid JSON with these fields:",
        "- title",
        "- topic",
        "- summary",
        "- learning_outcomes (array of strings)",
        "- explanation",
        "- worked_examples (array of strings, can be empty)",
        "- lesson_outline (array of strings)",
        "- activities (array of strings)",
        "- assessment (array of strings)",
        "- practice: { easy: string[], medium: string[], hard: string[] }",
        "- quiz: { questions: [{ id, type, prompt, options?, answer, explanation, difficulty, tags }] }",
        "- memo (array of strings)",
        "- teacher_notes (array of strings, optional)",
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
}
function resolveOutputPaths(input) {
    const lessonPath = getLessonJsonPath({
        gradeKey: String(input.grade),
        subjectKey: input.subjectKey,
        termKey: `term-${pad2(input.term)}`,
        weekNumber: input.week,
    });
    if (!lessonPath) {
        throw new Error("Failed to resolve lesson output path.");
    }
    const repoRoot = findRepoRoot();
    const reportsRoot = path.join(repoRoot, "content", "reports");
    const reportName = `rag_generation_${input.phase}_g${pad2(input.grade)}_${input.subjectKey}_t${pad2(input.term)}_w${pad2(input.week)}.md`;
    return { lessonPath, reportPath: path.join(reportsRoot, reportName) };
}
export async function generateRagWeekLesson(input, options = {}) {
    if (!Number.isFinite(input.grade) || input.grade < 0 || input.grade > 12) {
        throw new Error("Invalid grade.");
    }
    if (!Number.isFinite(input.term) || input.term < 1 || input.term > 4) {
        throw new Error("Invalid term.");
    }
    if (!Number.isFinite(input.week) || input.week < 1) {
        throw new Error("Invalid week.");
    }
    const normalizedSubject = normalizeSubjectDir(input.subjectKey);
    if (!normalizedSubject) {
        throw new Error("Subject key could not be normalized.");
    }
    const phase = input.phase && ["foundation", "intermediate", "senior", "fet"].includes(input.phase)
        ? input.phase
        : gradeToPhase(input.grade);
    const chunks = await retrieveChunks({
        phase,
        grade: input.grade,
        subjectKey: normalizedSubject,
        term: input.term,
        week: input.week,
        topic: input.topic,
        k: input.k ?? 12,
        indexPath: options.indexPath,
    });
    if (!chunks.length) {
        throw new Error("No chunks retrieved. Build the RAG index and try again.");
    }
    const resources = buildResources(chunks);
    const combinedText = chunks.map((chunk) => chunk.text).join("\n\n");
    let parsed = null;
    let usedModel = false;
    const prompt = buildPrompt({ ...input, phase, subjectKey: normalizedSubject }, chunks, false);
    const response = await callChatModel(prompt, options);
    if (response) {
        usedModel = true;
        parsed = extractJson(response);
        const outputText = JSON.stringify(parsed);
        if (hasLongOverlap(outputText, chunks.map((chunk) => chunk.text), 20)) {
            const retryPrompt = buildPrompt({ ...input, phase, subjectKey: normalizedSubject }, chunks, true);
            const retryResponse = await callChatModel(retryPrompt, options);
            if (!retryResponse) {
                throw new Error("Model retry failed.");
            }
            parsed = extractJson(retryResponse);
            const retryText = JSON.stringify(parsed);
            if (hasLongOverlap(retryText, chunks.map((chunk) => chunk.text), 20)) {
                throw new Error("Generated content overlaps too closely with sources.");
            }
        }
    }
    else {
        parsed = buildFallbackLesson({ ...input, phase, subjectKey: normalizedSubject }, chunks);
    }
    const fallbackDraft = buildFallbackLesson({ ...input, phase, subjectKey: normalizedSubject }, chunks);
    const outcomes = asStringArray(parsed.learning_outcomes ?? parsed.outcomes);
    const workedExamples = asStringArray(parsed.worked_examples ?? parsed.workedExamples);
    const teacherNotes = asStringArray(parsed.teacher_notes ?? parsed.teacherNotes);
    const memo = asStringArray(parsed.memo ?? parsed.answers);
    const practice = parsed.practice && typeof parsed.practice === "object"
        ? {
            easy: asStringArray(parsed.practice.easy),
            medium: asStringArray(parsed.practice.medium),
            hard: asStringArray(parsed.practice.hard),
        }
        : fallbackDraft.practice;
    const lessonOutlineSource = asStringArray(parsed.lesson_outline ?? parsed.lessonOutline);
    const activitiesSource = asStringArray(parsed.activities);
    const assessmentSource = asStringArray(parsed.assessment);
    const lessonOutline = lessonOutlineSource.length ? lessonOutlineSource : fallbackDraft.lesson_outline;
    const activities = activitiesSource.length ? activitiesSource : fallbackDraft.activities;
    const assessment = assessmentSource.length ? assessmentSource : fallbackDraft.assessment;
    let quiz = generateQuiz(combinedText, input.grade);
    if (parsed.quiz) {
        try {
            quiz = QuizSchema.parse(parsed.quiz);
        }
        catch {
            quiz = generateQuiz(combinedText, input.grade);
        }
    }
    if (quiz.questions.length > 10) {
        quiz.questions = quiz.questions.slice(0, 10);
    }
    if (quiz.questions.length < 6) {
        const fallback = generateQuiz(combinedText, input.grade);
        while (quiz.questions.length < 6 && fallback.questions.length) {
            quiz.questions.push(fallback.questions.shift());
        }
    }
    const title = asNonEmptyString(parsed.title) ||
        asNonEmptyString(parsed.topic) ||
        `${normalizedSubject.replace(/-/g, " ")} week ${input.week}`;
    const topic = asNonEmptyString(parsed.topic) || title;
    const summary = asNonEmptyString(parsed.summary) || fallbackDraft.summary;
    const extractedText = [summary, ...lessonOutline, ...activities, ...assessment]
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    const finalLesson = LessonSchema.parse({
        version: 3,
        grade: input.grade,
        phase,
        term: input.term,
        week: input.week,
        subject: normalizedSubject,
        title,
        topic,
        summary,
        outcomes: outcomes.length ? outcomes : undefined,
        explanation: asNonEmptyString(parsed.explanation) ?? undefined,
        workedExamples: workedExamples.length ? workedExamples : undefined,
        practice,
        lessonOutline,
        activities,
        assessment,
        resources,
        extractedText: extractedText || summary,
        quiz,
        memo: memo.length ? memo : undefined,
        teacherNotes: teacherNotes.length ? teacherNotes : undefined,
        sourceHashes: chunks.map(hashChunk),
    });
    const { lessonPath, reportPath } = resolveOutputPaths({
        ...input,
        phase,
        subjectKey: normalizedSubject,
    });
    await fs.mkdir(path.dirname(lessonPath), { recursive: true });
    await fs.writeFile(lessonPath, JSON.stringify(finalLesson, null, 2));
    const reportLines = [
        "# RAG Lesson Generation Report",
        "",
        `Generated: ${new Date().toISOString()}`,
        `Phase: ${phase}`,
        `Grade: ${input.grade}`,
        `Subject: ${normalizedSubject}`,
        `Term: ${input.term}`,
        `Week: ${input.week}`,
        `Topic: ${input.topic ?? ""}`,
        `Used model: ${usedModel ? "yes" : "no"}`,
        "",
        "## Retrieved chunks",
        "",
        "| File | Pages | Score |",
        "| --- | --- | ---: |",
        ...chunks.map((chunk) => `| ${chunk.file_path} | ${chunk.page_start}-${chunk.page_end} | ${chunk.score.toFixed(3)} |`),
        "",
    ];
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, reportLines.join("\n"));
    return {
        lesson: finalLesson,
        filePath: lessonPath,
        reportPath,
        chunks,
        usedModel,
    };
}
