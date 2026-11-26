import { type LessonV2Content } from "./schema.js";
export type GenerateLessonV2Input = {
    phase: "foundation" | "intermediate" | "senior" | "fet";
    grade: number;
    subjectKey: string;
    term: number;
    week: number;
    topic?: string;
    subjectName?: string;
};
export type GenerateLessonV2Options = {
    apiKey?: string;
    apiBase?: string;
    model?: string;
};
export type GenerateLessonV2Result = {
    content: LessonV2Content;
    usedModel: string;
};
export declare function generateLessonV2(input: GenerateLessonV2Input, options?: GenerateLessonV2Options): Promise<GenerateLessonV2Result>;
//# sourceMappingURL=generateLesson.d.ts.map