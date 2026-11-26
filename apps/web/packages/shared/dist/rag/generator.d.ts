import { type LessonContent } from "../lesson-content.js";
import { type RagChunkScore } from "./retrieval.js";
export type GenerateRagInput = {
    phase?: "foundation" | "intermediate" | "senior" | "fet";
    grade: number;
    subjectKey: string;
    term: number;
    week: number;
    topic?: string;
    k?: number;
};
export type GenerateRagOptions = {
    indexPath?: string;
    apiKey?: string;
    apiBase?: string;
    model?: string;
    maxSourceChars?: number;
};
export type GenerateRagResult = {
    lesson: LessonContent;
    filePath: string;
    reportPath: string;
    chunks: RagChunkScore[];
    usedModel: boolean;
};
export declare function generateRagWeekLesson(input: GenerateRagInput, options?: GenerateRagOptions): Promise<GenerateRagResult>;
//# sourceMappingURL=generator.d.ts.map