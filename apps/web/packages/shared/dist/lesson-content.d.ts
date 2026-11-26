import { z } from "zod";
export declare const QuizQuestionSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<["mcq", "true_false", "short_answer"]>;
    prompt: z.ZodString;
    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    answer: z.ZodString;
    explanation: z.ZodString;
    difficulty: z.ZodEnum<["easy", "medium", "hard"]>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "mcq" | "short_answer" | "true_false";
    id: string;
    prompt: string;
    answer: string;
    explanation: string;
    difficulty: "easy" | "medium" | "hard";
    tags: string[];
    options?: string[] | undefined;
}, {
    type: "mcq" | "short_answer" | "true_false";
    id: string;
    prompt: string;
    answer: string;
    explanation: string;
    difficulty: "easy" | "medium" | "hard";
    options?: string[] | undefined;
    tags?: string[] | undefined;
}>;
export declare const QuizSchema: z.ZodObject<{
    questions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<["mcq", "true_false", "short_answer"]>;
        prompt: z.ZodString;
        options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        answer: z.ZodString;
        explanation: z.ZodString;
        difficulty: z.ZodEnum<["easy", "medium", "hard"]>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "mcq" | "short_answer" | "true_false";
        id: string;
        prompt: string;
        answer: string;
        explanation: string;
        difficulty: "easy" | "medium" | "hard";
        tags: string[];
        options?: string[] | undefined;
    }, {
        type: "mcq" | "short_answer" | "true_false";
        id: string;
        prompt: string;
        answer: string;
        explanation: string;
        difficulty: "easy" | "medium" | "hard";
        options?: string[] | undefined;
        tags?: string[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    questions: {
        type: "mcq" | "short_answer" | "true_false";
        id: string;
        prompt: string;
        answer: string;
        explanation: string;
        difficulty: "easy" | "medium" | "hard";
        tags: string[];
        options?: string[] | undefined;
    }[];
}, {
    questions: {
        type: "mcq" | "short_answer" | "true_false";
        id: string;
        prompt: string;
        answer: string;
        explanation: string;
        difficulty: "easy" | "medium" | "hard";
        options?: string[] | undefined;
        tags?: string[] | undefined;
    }[];
}>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type Quiz = z.infer<typeof QuizSchema>;
export declare const LessonSchema: z.ZodObject<{
    version: z.ZodOptional<z.ZodNumber>;
    grade: z.ZodNumber;
    phase: z.ZodEnum<["foundation", "intermediate", "senior", "fet"]>;
    term: z.ZodNumber;
    week: z.ZodNumber;
    subject: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    topic: z.ZodString;
    summary: z.ZodString;
    outcomes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    explanation: z.ZodOptional<z.ZodString>;
    workedExamples: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    practice: z.ZodOptional<z.ZodObject<{
        easy: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        medium: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        hard: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        easy: string[];
        medium: string[];
        hard: string[];
    }, {
        easy?: string[] | undefined;
        medium?: string[] | undefined;
        hard?: string[] | undefined;
    }>>;
    lessonOutline: z.ZodArray<z.ZodString, "many">;
    activities: z.ZodArray<z.ZodString, "many">;
    assessment: z.ZodArray<z.ZodString, "many">;
    resources: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        sourcePdfPath: z.ZodString;
        pageRefs: z.ZodOptional<z.ZodString>;
        note: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        sourcePdfPath: string;
        pageRefs?: string | undefined;
        note?: string | undefined;
    }, {
        title: string;
        sourcePdfPath: string;
        pageRefs?: string | undefined;
        note?: string | undefined;
    }>, "many">;
    extractedText: z.ZodString;
    quiz: z.ZodObject<{
        questions: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodEnum<["mcq", "true_false", "short_answer"]>;
            prompt: z.ZodString;
            options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            answer: z.ZodString;
            explanation: z.ZodString;
            difficulty: z.ZodEnum<["easy", "medium", "hard"]>;
            tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            type: "mcq" | "short_answer" | "true_false";
            id: string;
            prompt: string;
            answer: string;
            explanation: string;
            difficulty: "easy" | "medium" | "hard";
            tags: string[];
            options?: string[] | undefined;
        }, {
            type: "mcq" | "short_answer" | "true_false";
            id: string;
            prompt: string;
            answer: string;
            explanation: string;
            difficulty: "easy" | "medium" | "hard";
            options?: string[] | undefined;
            tags?: string[] | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        questions: {
            type: "mcq" | "short_answer" | "true_false";
            id: string;
            prompt: string;
            answer: string;
            explanation: string;
            difficulty: "easy" | "medium" | "hard";
            tags: string[];
            options?: string[] | undefined;
        }[];
    }, {
        questions: {
            type: "mcq" | "short_answer" | "true_false";
            id: string;
            prompt: string;
            answer: string;
            explanation: string;
            difficulty: "easy" | "medium" | "hard";
            options?: string[] | undefined;
            tags?: string[] | undefined;
        }[];
    }>;
    memo: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    teacherNotes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sourceHashes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    assessment: string[];
    resources: {
        title: string;
        sourcePdfPath: string;
        pageRefs?: string | undefined;
        note?: string | undefined;
    }[];
    quiz: {
        questions: {
            type: "mcq" | "short_answer" | "true_false";
            id: string;
            prompt: string;
            answer: string;
            explanation: string;
            difficulty: "easy" | "medium" | "hard";
            tags: string[];
            options?: string[] | undefined;
        }[];
    };
    summary: string;
    phase: "foundation" | "intermediate" | "senior" | "fet";
    grade: number;
    subject: string;
    term: number;
    week: number;
    topic: string;
    lessonOutline: string[];
    activities: string[];
    extractedText: string;
    memo?: string[] | undefined;
    explanation?: string | undefined;
    title?: string | undefined;
    version?: number | undefined;
    outcomes?: string[] | undefined;
    workedExamples?: string[] | undefined;
    practice?: {
        easy: string[];
        medium: string[];
        hard: string[];
    } | undefined;
    teacherNotes?: string[] | undefined;
    sourceHashes?: string[] | undefined;
}, {
    assessment: string[];
    resources: {
        title: string;
        sourcePdfPath: string;
        pageRefs?: string | undefined;
        note?: string | undefined;
    }[];
    quiz: {
        questions: {
            type: "mcq" | "short_answer" | "true_false";
            id: string;
            prompt: string;
            answer: string;
            explanation: string;
            difficulty: "easy" | "medium" | "hard";
            options?: string[] | undefined;
            tags?: string[] | undefined;
        }[];
    };
    summary: string;
    phase: "foundation" | "intermediate" | "senior" | "fet";
    grade: number;
    subject: string;
    term: number;
    week: number;
    topic: string;
    lessonOutline: string[];
    activities: string[];
    extractedText: string;
    memo?: string[] | undefined;
    explanation?: string | undefined;
    title?: string | undefined;
    version?: number | undefined;
    outcomes?: string[] | undefined;
    workedExamples?: string[] | undefined;
    practice?: {
        easy?: string[] | undefined;
        medium?: string[] | undefined;
        hard?: string[] | undefined;
    } | undefined;
    teacherNotes?: string[] | undefined;
    sourceHashes?: string[] | undefined;
}>;
export type LessonContent = z.infer<typeof LessonSchema>;
export type LessonJsonLookup = {
    gradeKey: string;
    subjectKey: string;
    termKey: string;
    weekNumber: number;
};
export declare function getLessonJsonRoot(): string;
export declare function normalizeGradeDir(gradeKey: string): string | null;
export declare function normalizeSubjectDir(subjectKey: string): string;
export declare function parseTermNumber(termKey: string): number | null;
export declare function getLessonJsonPath(input: LessonJsonLookup): string | null;
export declare function readLessonJson(input: LessonJsonLookup): {
    assessment: string[];
    resources: {
        title: string;
        sourcePdfPath: string;
        pageRefs?: string | undefined;
        note?: string | undefined;
    }[];
    quiz: {
        questions: {
            type: "mcq" | "short_answer" | "true_false";
            id: string;
            prompt: string;
            answer: string;
            explanation: string;
            difficulty: "easy" | "medium" | "hard";
            tags: string[];
            options?: string[] | undefined;
        }[];
    };
    summary: string;
    phase: "foundation" | "intermediate" | "senior" | "fet";
    grade: number;
    subject: string;
    term: number;
    week: number;
    topic: string;
    lessonOutline: string[];
    activities: string[];
    extractedText: string;
    memo?: string[] | undefined;
    explanation?: string | undefined;
    title?: string | undefined;
    version?: number | undefined;
    outcomes?: string[] | undefined;
    workedExamples?: string[] | undefined;
    practice?: {
        easy: string[];
        medium: string[];
        hard: string[];
    } | undefined;
    teacherNotes?: string[] | undefined;
    sourceHashes?: string[] | undefined;
} | null;
//# sourceMappingURL=lesson-content.d.ts.map