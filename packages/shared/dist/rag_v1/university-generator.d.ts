import { type LessonV1 } from "../generated-lessons-v1.js";
export type UniversityGenerateInput = {
    institution: string;
    faculty: string;
    course: string;
    yearOfStudy: number;
    moduleCode: string;
    moduleName?: string;
    topic?: string;
    transcriptText?: string;
    topK?: number;
    force?: boolean;
};
export type UniversityGenerateOptions = {
    apiKey?: string;
    apiBase?: string;
    model?: string;
};
export type UniversityGenerateResult = {
    lesson: LessonV1;
    usedModel: string;
    promptHash: string;
};
export declare function getUniversityLessonOutputPaths(input: UniversityGenerateInput): {
    baseDir: string;
    lessonPath: string;
    generationPath: string;
};
export declare function generateUniversityModuleLesson(input: UniversityGenerateInput, options?: UniversityGenerateOptions): Promise<UniversityGenerateResult>;
export declare function writeUniversityLessonFiles(params: {
    input: UniversityGenerateInput;
    result: UniversityGenerateResult;
}): {
    baseDir: string;
    lessonPath: string;
    generationPath: string;
};
//# sourceMappingURL=university-generator.d.ts.map