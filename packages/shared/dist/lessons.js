import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const DEFAULT_LESSONS_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "content", "lessons");
const lessonCache = new Map();
export function getLessonsRoot() {
    return process.env.LESSON_CONTENT_PATH || DEFAULT_LESSONS_ROOT;
}
export function getLessonFilePath(input) {
    if (!input.phaseKey ||
        !input.gradeKey ||
        !input.subjectKey ||
        !input.termKey ||
        !Number.isFinite(input.weekNumber) ||
        input.weekNumber < 1) {
        return null;
    }
    const gradeSlug = `grade-${input.gradeKey.toLowerCase()}`;
    const subjectSlug = input.subjectKey.toLowerCase();
    const termSlug = input.termKey.toLowerCase();
    const weekSlug = `week${input.weekNumber}`;
    return join(getLessonsRoot(), input.phaseKey.toLowerCase(), gradeSlug, subjectSlug, termSlug, `${weekSlug}.md`);
}
export function readLessonMarkdown(input) {
    const filePath = getLessonFilePath(input);
    if (!filePath || !existsSync(filePath)) {
        return null;
    }
    const isProd = process.env.NODE_ENV === "production";
    const cached = lessonCache.get(filePath);
    if (cached) {
        if (isProd) {
            return { markdown: cached.markdown, path: cached.path };
        }
        try {
            const mtimeMs = statSync(filePath).mtimeMs;
            if (mtimeMs === cached.mtimeMs) {
                return { markdown: cached.markdown, path: cached.path };
            }
        }
        catch {
            // Ignore and reload from disk.
        }
    }
    const markdown = readFileSync(filePath, "utf-8");
    let mtimeMs = Date.now();
    try {
        mtimeMs = statSync(filePath).mtimeMs;
    }
    catch {
        // Keep fallback timestamp so cache still works if stat fails.
    }
    lessonCache.set(filePath, { markdown, path: filePath, mtimeMs });
    return { markdown, path: filePath };
}
