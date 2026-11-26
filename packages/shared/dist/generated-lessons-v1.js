import { z } from "zod";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
export const VideoChapterSchema = z.object({
    title: z.string().min(1),
    startSeconds: z.number().nonnegative(),
    endSeconds: z.number().positive().optional(),
    summary: z.string().optional(),
});
export const VideoLessonMetaSchema = z.object({
    videoUrl: z.string().url(),
    thumbnailUrl: z.string().url().optional(),
    durationSeconds: z.number().positive().optional(),
    provider: z.enum(["heygen", "elevenlabs", "youtube", "vimeo", "other"]).default("other"),
    transcript: z.string().optional(),
    chapters: z.array(VideoChapterSchema).optional(),
    captionsUrl: z.string().url().optional(),
});
export const LessonV1CitationSchema = z.object({
    source_path: z.string().min(1),
    page_start: z.number().int().min(1),
    page_end: z.number().int().min(1),
    snippet_hash: z.string().min(1),
});
export const LessonV1SectionSchema = z.object({
    heading: z.string().min(1),
    content: z.string().min(1),
});
export const LessonV1QuizQuestionSchema = z.object({
    id: z.string().min(1),
    type: z.enum(["mcq", "short_answer"]),
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).min(3).max(5).optional(),
    answer: z.string().min(1),
    explanation: z.string().min(1),
});
export const LessonV1Schema = z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
    objectives: z.array(z.string().min(1)).min(1),
    sections: z.object({
        explanation: z.array(LessonV1SectionSchema).min(1),
        worked_examples: z.array(LessonV1SectionSchema).min(1),
        guided_practice: z.array(LessonV1SectionSchema).min(1),
        independent_practice: z.array(LessonV1SectionSchema).min(1),
    }),
    quiz: z.object({
        questions: z.array(LessonV1QuizQuestionSchema).min(8),
    }),
    teacher_notes: z.array(z.string().min(1)).optional(),
    citations: z.array(LessonV1CitationSchema).min(1),
    video: VideoLessonMetaSchema.optional(),
});
function pad2(value) {
    return String(value).padStart(2, "0");
}
function normalizeGradeDir(grade) {
    const num = typeof grade === "number" ? grade : Number(grade);
    if (!Number.isFinite(num))
        return null;
    return `grade-${pad2(num)}`;
}
function normalizeTermDir(term) {
    const num = typeof term === "number" ? term : Number(term);
    if (!Number.isFinite(num))
        return null;
    return `term-${pad2(num)}`;
}
function normalizeWeekDir(week) {
    const num = typeof week === "number" ? week : Number(week);
    if (!Number.isFinite(num))
        return null;
    return `week-${pad2(num)}`;
}
const moduleRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(moduleRoot, "..", "..", "..");
const DEFAULT_LESSON_ROOT = join(repoRoot, "content", "generated_lessons", "v1");
const lessonCache = new Map();
export function getGeneratedLessonRoot() {
    const override = process.env.GENERATED_LESSON_ROOT;
    if (override)
        return override;
    const cwd = process.cwd();
    const candidates = [
        DEFAULT_LESSON_ROOT,
        join(cwd, "content", "generated_lessons", "v1"),
        join(cwd, "..", "content", "generated_lessons", "v1"),
        join(cwd, "..", "..", "content", "generated_lessons", "v1"),
    ];
    for (const candidate of candidates) {
        if (existsSync(candidate))
            return candidate;
    }
    return DEFAULT_LESSON_ROOT;
}
export function getGeneratedLessonPath(input) {
    const gradeDir = normalizeGradeDir(input.grade);
    const termDir = normalizeTermDir(input.term);
    const weekDir = normalizeWeekDir(input.week);
    const subjectDir = input.subjectKey.trim().toLowerCase();
    const phaseDir = input.phase.trim().toLowerCase();
    if (!gradeDir || !termDir || !weekDir || !subjectDir || !phaseDir)
        return null;
    const base = join(getGeneratedLessonRoot(), phaseDir, gradeDir, subjectDir, termDir, weekDir);
    // Per-language variant (lesson.<lang>.json); fall back to the default lesson.json.
    const lang = input.language?.trim().toLowerCase();
    if (lang && /^[a-z]{2}$/.test(lang)) {
        const langPath = join(base, `lesson.${lang}.json`);
        if (existsSync(langPath))
            return langPath;
    }
    return join(base, "lesson.json");
}
export function readGeneratedLesson(input) {
    const filePath = getGeneratedLessonPath(input);
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
    const parsed = LessonV1Schema.parse(JSON.parse(raw));
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
function slugifySegment(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-{2,}/g, "-");
}
function getGeneratedUniversityLessonRoot() {
    const override = process.env.UNIVERSITY_LESSON_ROOT;
    if (override)
        return override;
    const cwd = process.cwd();
    const defaultRoot = join(repoRoot, "content", "university-lessons");
    const candidates = [
        defaultRoot,
        join(cwd, "content", "university-lessons"),
        join(cwd, "..", "content", "university-lessons"),
        join(cwd, "..", "..", "content", "university-lessons"),
    ];
    for (const candidate of candidates) {
        if (existsSync(candidate))
            return candidate;
    }
    return defaultRoot;
}
export function getGeneratedUniversityLessonPath(input) {
    const year = typeof input.yearOfStudy === "number" ? input.yearOfStudy : Number(input.yearOfStudy);
    if (!Number.isFinite(year) || year < 1)
        return null;
    return join(getGeneratedUniversityLessonRoot(), slugifySegment(input.institution), slugifySegment(input.faculty), slugifySegment(input.course), `year-${String(Math.round(year)).padStart(2, "0")}`, slugifySegment(input.moduleCode), "lesson.json");
}
export function readGeneratedUniversityLesson(input) {
    const filePath = getGeneratedUniversityLessonPath(input);
    if (!filePath || !existsSync(filePath))
        return null;
    const isProd = process.env.NODE_ENV === "production";
    const cached = lessonCache.get(filePath);
    if (cached) {
        if (isProd)
            return cached.lesson;
        try {
            const mtimeMs = statSync(filePath).mtimeMs;
            if (mtimeMs === cached.mtimeMs)
                return cached.lesson;
        }
        catch {
            // ignore
        }
    }
    const raw = readFileSync(filePath, "utf-8");
    const parsed = LessonV1Schema.parse(JSON.parse(raw));
    let mtimeMs = Date.now();
    try {
        mtimeMs = statSync(filePath).mtimeMs;
    }
    catch { /* keep fallback */ }
    lessonCache.set(filePath, { lesson: parsed, mtimeMs });
    return parsed;
}
