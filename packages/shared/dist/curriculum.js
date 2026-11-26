import { z } from "zod";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { VideoLessonMetaSchema } from "./generated-lessons-v1.js";
export const WeekSchema = z.object({
    name: z.string(),
    topic_title: z.string(),
    summary_md: z.string(),
    video_url: z.string().default(""),
    video: VideoLessonMetaSchema.optional(),
    quiz: z
        .object({
        enabled: z.boolean(),
        questions: z.array(z.any()),
    })
        .default({ enabled: false, questions: [] }),
    content_items: z.array(z.any()).default([]),
});
export const TermSchema = z.object({
    name: z.string(),
    weeks: z.array(WeekSchema),
});
export const SubjectSchema = z.lazy(() => z.object({
    name: z.string(),
    terms: z.record(TermSchema).optional(),
    children: z.record(SubjectSchema).optional(),
}));
export const GroupSchema = z.object({
    name: z.string(),
    subjects: z.record(SubjectSchema),
});
export const GradeSchema = z.object({
    name: z.string(),
    groups: z.record(GroupSchema),
});
export const PhaseSchema = z.object({
    name: z.string(),
    grades: z.record(GradeSchema),
});
export const CourseOutlineSchema = z.object({
    phases: z.record(PhaseSchema),
});
let cachedOutline = null;
let cachedPath = null;
let cachedMtimeMs = null;
function resolveCourseOutlinePath() {
    if (process.env.COURSE_OUTLINE_PATH)
        return process.env.COURSE_OUTLINE_PATH;
    // Primary: relative to this compiled file (works when package is loaded as external / non-bundled)
    const metaPath = join(dirname(fileURLToPath(import.meta.url)), "..", "content", "course_outline.json");
    if (existsSync(metaPath))
        return metaPath;
    // Fallbacks for bundled / standalone environments where import.meta.url is the chunk location
    const cwd = process.cwd();
    const candidates = [
        join(cwd, "packages", "shared", "content", "course_outline.json"),
        join(cwd, "..", "packages", "shared", "content", "course_outline.json"),
        join(cwd, "content", "course_outline.json"),
        join(cwd, "..", "content", "course_outline.json"),
    ];
    for (const candidate of candidates) {
        if (existsSync(candidate))
            return candidate;
    }
    return metaPath; // will throw a clear ENOENT with the path visible in logs
}
export function loadCourseOutline() {
    const isProd = process.env.NODE_ENV === "production";
    const filePath = resolveCourseOutlinePath();
    if (isProd && cachedOutline) {
        return cachedOutline;
    }
    let mtimeMs = null;
    if (!isProd && cachedOutline && cachedPath === filePath) {
        try {
            mtimeMs = statSync(filePath).mtimeMs;
            if (cachedMtimeMs === mtimeMs) {
                return cachedOutline;
            }
        }
        catch {
            mtimeMs = null;
        }
    }
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const outline = CourseOutlineSchema.parse(parsed);
    cachedOutline = outline;
    cachedPath = filePath;
    cachedMtimeMs = mtimeMs ?? statSync(filePath).mtimeMs;
    return outline;
}
