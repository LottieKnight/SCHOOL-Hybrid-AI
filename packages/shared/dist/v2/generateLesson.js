import { randomUUID } from "node:crypto";
import { LessonV2Schema } from "./schema.js";
import { loadCapsScaffold } from "../gen/caps-scaffold.js";
import { languageDirective, isLessonLanguage } from "./language.js";
function getApiConfig(options) {
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
    if (!apiKey) {
        throw new Error("Missing OPENAI_API_KEY (or LLM_API_KEY). Set it in your environment.");
    }
    const apiBase = options.apiBase || process.env.OPENAI_API_BASE || process.env.LLM_API_BASE || "https://api.openai.com/v1";
    const model = options.model || process.env.OPENAI_MODEL || process.env.LLM_MODEL || "gpt-4o-mini";
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
            temperature: 0.3,
            messages: [
                {
                    role: "system",
                    content: "You are a CAPS-aligned curriculum author. Produce original lesson content and never copy source text verbatim.",
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
function coerceStringArray(value, fallback = []) {
    if (!Array.isArray(value))
        return fallback;
    return value
        .map((item) => (typeof item === "string" ? item : String(item)))
        .map((item) => item.trim())
        .filter(Boolean);
}
function ensureNonEmpty(value, fallback) {
    if (!value)
        return fallback;
    const trimmed = value.trim();
    return trimmed ? trimmed : fallback;
}
function normalizeSections(raw, fallbackSummary) {
    if (!Array.isArray(raw)) {
        return [{ heading: "Lesson Notes", content: fallbackSummary }];
    }
    const sections = raw
        .map((entry) => ({
        heading: typeof entry?.heading === "string" ? entry.heading.trim() : "",
        content: typeof entry?.content === "string" ? entry.content.trim() : "",
    }))
        .filter((entry) => entry.heading && entry.content);
    if (!sections.length) {
        return [{ heading: "Lesson Notes", content: fallbackSummary }];
    }
    return sections;
}
function normalizePractice(raw) {
    const empty = { easy: [], medium: [], hard: [] };
    if (!raw || typeof raw !== "object")
        return empty;
    return {
        easy: coerceStringArray(raw.easy),
        medium: coerceStringArray(raw.medium),
        hard: coerceStringArray(raw.hard),
    };
}
function normalizeQuiz(raw) {
    if (!raw || typeof raw !== "object")
        return null;
    const questions = Array.isArray(raw.questions) ? raw.questions : [];
    const normalized = questions
        .map((question, idx) => {
        const type = typeof question?.type === "string" ? question.type : "short_answer";
        return {
            id: typeof question?.id === "string" ? question.id : `q${idx + 1}`,
            type,
            prompt: typeof question?.prompt === "string" ? question.prompt.trim() : "",
            options: Array.isArray(question?.options)
                ? question.options.map(String).map((v) => v.trim())
                : undefined,
            answer: question?.answer ?? "",
            explanation: typeof question?.explanation === "string" ? question.explanation.trim() : "",
            difficulty: typeof question?.difficulty === "string" ? question.difficulty : undefined,
            tags: Array.isArray(question?.tags) ? question.tags.map(String).map((v) => v.trim()) : undefined,
        };
    })
        .filter((question) => question.prompt && question.explanation && question.answer);
    return {
        questions: normalized,
        answers: coerceStringArray(raw.answers),
        memo: coerceStringArray(raw.memo),
    };
}
function validateQuiz(quiz) {
    if (!quiz || !Array.isArray(quiz.questions)) {
        throw new Error("Quiz missing questions.");
    }
    if (quiz.questions.length < 6 || quiz.questions.length > 10) {
        throw new Error("Quiz must have between 6 and 10 questions.");
    }
    quiz.questions.forEach((question) => {
        if (question.type === "mcq" && (!question.options || question.options.length < 3)) {
            throw new Error("MCQ questions must include 3-5 options.");
        }
    });
}
function findWeekInScaffold(scaffold, input) {
    const [baseKey, childKey] = input.subjectKey.split("__");
    const phase = scaffold.phases?.[input.phase];
    const gradeKey = input.grade === 0 ? "R" : String(input.grade);
    const grade = phase?.grades?.[gradeKey];
    if (!grade)
        return null;
    for (const group of Object.values(grade.groups ?? {})) {
        for (const [subjectKey, subject] of Object.entries(group.subjects ?? {})) {
            if (subjectKey !== baseKey)
                continue;
            const targetSubject = childKey ? subject.children?.[childKey] : subject;
            if (!targetSubject)
                return null;
            const terms = targetSubject.terms ?? {};
            const termKey = Object.keys(terms).find((key) => Number(key.replace(/\D/g, "")) === input.term);
            const term = termKey ? terms[termKey] : null;
            if (!term)
                return null;
            const week = term.weeks?.[input.week - 1] ?? null;
            return { termKey, week };
        }
    }
    return null;
}
export async function generateLessonV2(input, options = {}) {
    if (!input.subjectKey || !input.subjectKey.trim()) {
        throw new Error("Subject key is required.");
    }
    if (!Number.isFinite(input.grade) || input.grade < 0 || input.grade > 12) {
        throw new Error("Invalid grade.");
    }
    if (!Number.isFinite(input.term) || input.term < 1 || input.term > 4) {
        throw new Error("Invalid term.");
    }
    if (!Number.isFinite(input.week) || input.week < 1 || input.week > 52) {
        throw new Error("Invalid week.");
    }
    const scaffold = loadCapsScaffold();
    const weekInfo = findWeekInScaffold(scaffold, input);
    const scaffoldSummary = weekInfo?.week?.summary_md ?? "";
    const scaffoldOutcomes = weekInfo?.week?.outcomes ?? [];
    const scaffoldTopic = weekInfo?.week?.topic_title ?? "";
    const topic = ensureNonEmpty(input.topic, scaffoldTopic || input.subjectKey);
    const subjectName = input.subjectName?.trim() || input.subjectKey.replace(/__/g, " ");
    const now = new Date().toISOString();
    const prompt = [
        `Create a CAPS-aligned lesson for ${input.phase} phase, grade ${input.grade}, subject ${subjectName}, term ${input.term}, week ${input.week}.`,
        `Topic focus: ${topic}.`,
        scaffoldSummary ? `Scaffold summary (do not copy verbatim): ${scaffoldSummary}` : "",
        scaffoldOutcomes.length ? `Scaffold outcomes: ${scaffoldOutcomes.join(" | ")}` : "",
        "Return ONLY valid JSON with the following shape:",
        "{",
        "  title: string,",
        "  topic: string,",
        "  summary: string,",
        "  outcomes: string[],",
        "  sections: [{ heading: string, content: string }],",
        "  workedExamples: string[],",
        "  practice: { easy: string[], medium: string[], hard: string[] },",
        "  quiz: { questions: [{ id, type, prompt, options?, answer, explanation, difficulty?, tags? }], answers?: string[], memo?: string[] },",
        "  resources: [{ label: string, href: string, sourceNote?: string }]",
        "}",
        "Quiz rules:",
        "- 6 to 10 questions",
        "- type is one of: mcq, true_false, short_answer",
        "- MCQ includes 3-5 options",
        "- include an answer + explanation for every question",
        "Write original content. Do not copy sentences verbatim from scaffold or sources.",
        languageDirective(input.language),
    ]
        .filter(Boolean)
        .join("\n");
    const { text, model } = await callChatModel(prompt, options);
    const parsed = extractJson(text);
    const summary = ensureNonEmpty(parsed.summary, scaffoldSummary || `Week ${input.week} lesson overview.`);
    const outcomes = coerceStringArray(parsed.outcomes, scaffoldOutcomes);
    const sections = normalizeSections(parsed.sections, summary);
    const workedExamples = coerceStringArray(parsed.workedExamples);
    const practice = normalizePractice(parsed.practice);
    const quiz = normalizeQuiz(parsed.quiz);
    const resources = Array.isArray(parsed.resources)
        ? parsed.resources
            .map((entry) => ({
            label: typeof entry?.label === "string" ? entry.label.trim() : "",
            href: typeof entry?.href === "string" ? entry.href.trim() : "",
            sourceNote: typeof entry?.sourceNote === "string" ? entry.sourceNote.trim() : undefined,
        }))
            .filter((entry) => entry.label && entry.href)
        : [];
    if (!quiz) {
        throw new Error("Quiz payload missing or invalid.");
    }
    if (quiz.questions.length > 10) {
        quiz.questions = quiz.questions.slice(0, 10);
    }
    if (quiz.questions.length < 6) {
        throw new Error("Quiz must include at least 6 questions.");
    }
    validateQuiz(quiz);
    const lesson = LessonV2Schema.parse({
        id: randomUUID(),
        phase: input.phase,
        grade: input.grade,
        subjectKey: input.subjectKey,
        term: input.term,
        week: input.week,
        title: ensureNonEmpty(parsed.title, `${subjectName} - Week ${input.week}`),
        topic: ensureNonEmpty(parsed.topic, topic),
        summary,
        outcomes: outcomes.length ? outcomes : ["Understand the main ideas for the week."],
        sections,
        workedExamples,
        practice,
        quiz,
        resources,
        version: 1,
        createdAt: now,
        updatedAt: now,
        language: input.language && isLessonLanguage(input.language) ? input.language : "en",
    });
    return { content: lesson, usedModel: model };
}
