import { type LessonV1 } from "../generated-lessons-v1.js";
import { type RagV1ChunkScore } from "./retrieval.js";
export type RagV1GenerateInput = {
    phase: "foundation" | "intermediate" | "senior" | "fet";
    grade: number;
    subjectKey: string;
    term: number;
    week: number;
    topic?: string;
    topK?: number;
    force?: boolean;
};
export type RagV1GenerateOptions = {
    indexPath?: string;
    apiKey?: string;
    apiBase?: string;
    model?: string;
    maxSourceChars?: number;
};
export type RagV1GenerateResult = {
    lesson: LessonV1;
    citations: LessonCitation[];
    usedChunks: RagV1ChunkScore[];
    usedModel: string;
    promptHash: string;
};
type LessonCitation = {
    source_path: string;
    page_start: number;
    page_end: number;
    snippet_hash: string;
};
export declare function generateLessonV1(input: RagV1GenerateInput, options?: RagV1GenerateOptions): Promise<RagV1GenerateResult>;
export declare function getGeneratedLessonOutputPaths(input: RagV1GenerateInput): {
    baseDir: string;
    lessonPath: string;
    sourcesPath: string;
    generationPath: string;
};
export declare function writeGeneratedLessonFiles(params: {
    input: RagV1GenerateInput;
    result: RagV1GenerateResult;
}): {
    baseDir: string;
    lessonPath: string;
    sourcesPath: string;
    generationPath: string;
};
export {};
//# sourceMappingURL=generator.d.ts.map