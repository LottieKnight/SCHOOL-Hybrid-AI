import { z } from "zod";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
export const QuizQuestionSchema = z.object({
    id: z.string().min(1),
    type: z.enum(["mcq", "true_false", "short_answer"]),
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).min(3).max(5).optional(),
    answer: z.string().min(1),
    explanation: z.string().min(1),
    difficulty: z.enum(["easy", "medium", "hard"]),
    tags: z.array(z.string().min(1)).default([]),
});
export const QuizSchema = z.object({
    questions: z.array(QuizQuestionSchema).min(1),
});
export const LessonSchema = z.object({
    version: z.number().int().optional(),
    grade: z.number(),
    phase: z.enum(["foundation", "intermediate", "senior", "fet"]),
    term: z.number().int().min(1).max(4),
    week: z.number().int().min(1).max(53),
    subject: z.string().min(1),
    title: z.string().min(1).optional(),
    topic: z.string().min(1),
    summary: z.string().min(1),
    outcomes: z.array(z.string().min(1)).optional(),
    explanation: z.string().min(1).optional(),
    workedExamples: z.array(z.string().min(1)).optional(),
    practice: z
        .object({
        easy: z.array(z.string().min(1)).default([]),
        medium: z.array(z.string().min(1)).default([]),
        hard: z.array(z.string().min(1)).default([]),
    })
        .optional(),
    lessonOutline: z.array(z.string().min(1)),
    activities: z.array(z.string().min(1)),
    assessment: z.array(z.string().min(1)),
    resources: z.array(z.object({
        title: z.string().min(1),
        sourcePdfPath: z.string().min(1),
        pageRefs: z.string().optional(),
        note: z.string().min(1).optional(),
    })),
    extractedText: z.string().min(1),
    quiz: QuizSchema,
    memo: z.array(z.string().min(1)).optional(),
    teacherNotes: z.array(z.string().min(1)).optional(),
    sourceHashes: z.array(z.string().min(1)).optional(),
});
function pad2(value) {
    return String(value).padStart(2, "0");
}
const moduleRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(moduleRoot, "..", "..", "..");
const DEFAULT_JSON_ROOT = join(repoRoot, "content", "lessons");
const LEGACY_JSON_ROOT = join(moduleRoot, "..", "content", "lessons");
const lessonCache = new Map();
export function getLessonJsonRoot() {
    const override = process.env.LESSON_JSON_ROOT;
    if (override)
        return override;
    const cwd = process.cwd();
    const candidates = [
        DEFAULT_JSON_ROOT,
        join(cwd, "content", "lessons"),
        join(cwd, "..", "content", "lessons"),
        join(cwd, "..", "..", "content", "lessons"),
        LEGACY_JSON_ROOT,
    ];
    for (const candidate of candidates) {
        if (existsSync(candidate))
            return candidate;
    }
    return DEFAULT_JSON_ROOT;
}
export function normalizeGradeDir(gradeKey) {
    const trimmed = gradeKey.trim();
    if (!trimmed)
        return null;
    const lower = trimmed.toLowerCase();
    if (lower === "r") {
        return "grade-00";
    }
    if (lower.startsWith("grade-")) {
        const match = lower.match(/grade-([0-9]{1,2}|r)\b/);
        if (!match)
            return null;
        if (match[1] === "r")
            return "grade-00";
        const num = Number(match[1]);
        if (!Number.isFinite(num))
            return null;
        return `grade-${pad2(num)}`;
    }
    const match = lower.match(/\d+/);
    if (!match)
        return null;
    const num = Number(match[0]);
    if (!Number.isFinite(num))
        return null;
    return `grade-${pad2(num)}`;
}
export function normalizeSubjectDir(subjectKey) {
    return subjectKey
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}
export function parseTermNumber(termKey) {
    const match = termKey.match(/\d+/);
    if (!match)
        return null;
    const value = Number(match[0]);
    if (!Number.isFinite(value))
        return null;
    return value;
}
export function getLessonJsonPath(input) {
    const gradeDir = normalizeGradeDir(input.gradeKey);
    if (!gradeDir)
        return null;
    const subjectDir = normalizeSubjectDir(input.subjectKey);
    const termNumber = parseTermNumber(input.termKey);
    if (!termNumber || !Number.isFinite(input.weekNumber) || input.weekNumber < 1) {
        return null;
    }
    const termDir = `term-${pad2(termNumber)}`;
    const weekFile = `week-${pad2(input.weekNumber)}.json`;
    return join(getLessonJsonRoot(), gradeDir, subjectDir, termDir, weekFile);
}
export function readLessonJson(input) {
    const filePath = getLessonJsonPath(input);
    if (!filePath || !existsSync(filePath)) {
        return null;
    }
    const isProd = process.env.NODE_ENV === "production";
    const cached = lessonCache.get(filePath);
    if (cached) {
        if (isProd) {
            return cached.lesson;
        }
        try {
            const mtimeMs = statSync(filePath).mtimeMs;
            if (mtimeMs === cached.mtimeMs) {
                return cached.lesson;
            }
        }
        catch {
            // ignore cache if stat fails
        }
    }
    const raw = readFileSync(filePath, "utf-8");
    const parsed = LessonSchema.parse(JSON.parse(raw));
    let mtimeMs = Date.now();
    try {
        mtimeMs = statSync(filePath).mtimeMs;
    }
    catch {
        // keep fallback
    }
    lessonCache.set(filePath, { lesson: parsed, mtimeMs });
    return parsed;
}
