import { type LessonContent } from "./lesson-content.js";
import { type ContentChunk } from "./retrieval.js";
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
export declare function generateWeekLesson(input: GenerateLessonInput, options?: GenerateLessonOptions): Promise<GenerateLessonResult>;
//# sourceMappingURL=lesson-generator.d.ts.map