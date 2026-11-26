import { type Quiz } from "../lesson-content.js";
import { type RagChunkScore } from "../rag/retrieval.js";
import { type LessonLanguage } from "../v2/language.js";
export type GenerateAiLessonInput = {
    phase: "foundation" | "intermediate" | "senior" | "fet";
    grade: number;
    subjectKey: string;
    term: number;
    week: number;
    lessonIndex?: number;
    topic?: string;
    language?: LessonLanguage;
};
export type GenerateAiLessonOptions = {
    k?: number;
    apiKey?: string;
    apiBase?: string;
    model?: string;
};
export type LessonNoteSection = {
    title: string;
    bullets: string[];
};
export type LessonCitation = {
    file_path: string;
    page_start: number;
    page_end: number;
    note?: string;
};
export type LessonChartData = {
    labels: string[];
    values: number[];
};
export type LessonVisual = {
    kind: "diagram";
    title: string;
    diagramCode: string;
    caption?: string;
} | {
    kind: "chart";
    chartType: "bar" | "line" | "pie";
    title: string;
    data: LessonChartData;
    caption?: string;
} | {
    kind: "image";
    title: string;
    src?: string;
    alt: string;
    caption?: string;
} | {
    kind: "widget";
    widgetType: "slider" | "drag-categorise" | "flashcard";
    title: string;
    config: Record<string, unknown>;
    caption?: string;
};
export type GeneratedLessonContent = {
    title: string;
    topic: string;
    summary: string;
    learningOutcomes: string[];
    lessonNotes: LessonNoteSection[];
    workedExamples: string[];
    practice: {
        easy: string[];
        medium: string[];
        hard: string[];
    };
    quiz: Quiz;
    memo: {
        questionId: string;
        answer: string;
        explanation?: string;
    }[];
    teacherNotes?: string[];
    citations: LessonCitation[];
    visuals: LessonVisual[];
    language: string;
};
export type GeneratedAiLessonResult = {
    content: GeneratedLessonContent;
    usedChunks: RagChunkScore[];
    usedModel: boolean;
};
export declare function generateAiLesson(input: GenerateAiLessonInput, options?: GenerateAiLessonOptions): Promise<GeneratedAiLessonResult>;
//# sourceMappingURL=lessonGenerator.d.ts.map