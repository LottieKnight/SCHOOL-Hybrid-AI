import { z } from "zod";
export declare const LessonV2SectionSchema: z.ZodObject<{
    heading: z.ZodString;
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
    heading: string;
}, {
    content: string;
    heading: string;
}>;
export declare const LessonV2PracticeSchema: z.ZodObject<{
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
}>;
export declare const LessonV2QuizQuestionSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["mcq", "true_false", "short_answer"]>;
    prompt: z.ZodString;
    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    answer: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>;
    explanation: z.ZodString;
    difficulty: z.ZodOptional<z.ZodEnum<["easy", "medium", "hard"]>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "mcq" | "short_answer" | "true_false";
    prompt: string;
    answer: string | string[];
    explanation: string;
    options?: string[] | undefined;
    id?: string | undefined;
    difficulty?: "easy" | "medium" | "hard" | undefined;
    tags?: string[] | undefined;
}, {
    type: "mcq" | "short_answer" | "true_false";
    prompt: string;
    answer: string | string[];
    explanation: string;
    options?: string[] | undefined;
    id?: string | undefined;
    difficulty?: "easy" | "medium" | "hard" | undefined;
    tags?: string[] | undefined;
}>;
export declare const LessonV2QuizSchema: z.ZodObject<{
    questions: z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["mcq", "true_false", "short_answer"]>;
        prompt: z.ZodString;
        options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        answer: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>;
        explanation: z.ZodString;
        difficulty: z.ZodOptional<z.ZodEnum<["easy", "medium", "hard"]>>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "mcq" | "short_answer" | "true_false";
        prompt: string;
        answer: string | string[];
        explanation: string;
        options?: string[] | undefined;
        id?: string | undefined;
        difficulty?: "easy" | "medium" | "hard" | undefined;
        tags?: string[] | undefined;
    }, {
        type: "mcq" | "short_answer" | "true_false";
        prompt: string;
        answer: string | string[];
        explanation: string;
        options?: string[] | undefined;
        id?: string | undefined;
        difficulty?: "easy" | "medium" | "hard" | undefined;
        tags?: string[] | undefined;
    }>, "many">;
    answers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    memo: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    questions: {
        type: "mcq" | "short_answer" | "true_false";
        prompt: string;
        answer: string | string[];
        explanation: string;
        options?: string[] | undefined;
        id?: string | undefined;
        difficulty?: "easy" | "medium" | "hard" | undefined;
        tags?: string[] | undefined;
    }[];
    memo?: string[] | undefined;
    answers?: string[] | undefined;
}, {
    questions: {
        type: "mcq" | "short_answer" | "true_false";
        prompt: string;
        answer: string | string[];
        explanation: string;
        options?: string[] | undefined;
        id?: string | undefined;
        difficulty?: "easy" | "medium" | "hard" | undefined;
        tags?: string[] | undefined;
    }[];
    memo?: string[] | undefined;
    answers?: string[] | undefined;
}>;
export declare const LessonV2ResourceSchema: z.ZodObject<{
    label: z.ZodString;
    href: z.ZodString;
    sourceNote: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    label: string;
    href: string;
    sourceNote?: string | undefined;
}, {
    label: string;
    href: string;
    sourceNote?: string | undefined;
}>;
export declare const LessonV2Schema: z.ZodObject<{
    id: z.ZodString;
    phase: z.ZodEnum<["foundation", "intermediate", "senior", "fet"]>;
    grade: z.ZodNumber;
    subjectKey: z.ZodString;
    term: z.ZodNumber;
    week: z.ZodNumber;
    title: z.ZodString;
    topic: z.ZodString;
    summary: z.ZodString;
    outcomes: z.ZodArray<z.ZodString, "many">;
    sections: z.ZodArray<z.ZodObject<{
        heading: z.ZodString;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        content: string;
        heading: string;
    }, {
        content: string;
        heading: string;
    }>, "many">;
    workedExamples: z.ZodArray<z.ZodString, "many">;
    practice: z.ZodObject<{
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
    }>;
    quiz: z.ZodObject<{
        questions: z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            type: z.ZodEnum<["mcq", "true_false", "short_answer"]>;
            prompt: z.ZodString;
            options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            answer: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>;
            explanation: z.ZodString;
            difficulty: z.ZodOptional<z.ZodEnum<["easy", "medium", "hard"]>>;
            tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            type: "mcq" | "short_answer" | "true_false";
            prompt: string;
            answer: string | string[];
            explanation: string;
            options?: string[] | undefined;
            id?: string | undefined;
            difficulty?: "easy" | "medium" | "hard" | undefined;
            tags?: string[] | undefined;
        }, {
            type: "mcq" | "short_answer" | "true_false";
            prompt: string;
            answer: string | string[];
            explanation: string;
            options?: string[] | undefined;
            id?: string | undefined;
            difficulty?: "easy" | "medium" | "hard" | undefined;
            tags?: string[] | undefined;
        }>, "many">;
        answers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        memo: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        questions: {
            type: "mcq" | "short_answer" | "true_false";
            prompt: string;
            answer: string | string[];
            explanation: string;
            options?: string[] | undefined;
            id?: string | undefined;
            difficulty?: "easy" | "medium" | "hard" | undefined;
            tags?: string[] | undefined;
        }[];
        memo?: string[] | undefined;
        answers?: string[] | undefined;
    }, {
        questions: {
            type: "mcq" | "short_answer" | "true_false";
            prompt: string;
            answer: string | string[];
            explanation: string;
            options?: string[] | undefined;
            id?: string | undefined;
            difficulty?: "easy" | "medium" | "hard" | undefined;
            tags?: string[] | undefined;
        }[];
        memo?: string[] | undefined;
        answers?: string[] | undefined;
    }>;
    resources: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        href: z.ZodString;
        sourceNote: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        label: string;
        href: string;
        sourceNote?: string | undefined;
    }, {
        label: string;
        href: string;
        sourceNote?: string | undefined;
    }>, "many">;
    version: z.ZodNumber;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    language: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    resources: {
        label: string;
        href: string;
        sourceNote?: string | undefined;
    }[];
    title: string;
    summary: string;
    id: string;
    sections: {
        content: string;
        heading: string;
    }[];
    quiz: {
        questions: {
            type: "mcq" | "short_answer" | "true_false";
            prompt: string;
            answer: string | string[];
            explanation: string;
            options?: string[] | undefined;
            id?: string | undefined;
            difficulty?: "easy" | "medium" | "hard" | undefined;
            tags?: string[] | undefined;
        }[];
        memo?: string[] | undefined;
        answers?: string[] | undefined;
    };
    language: string;
    phase: "foundation" | "intermediate" | "senior" | "fet";
    grade: number;
    subjectKey: string;
    term: number;
    week: number;
    version: number;
    topic: string;
    outcomes: string[];
    workedExamples: string[];
    practice: {
        easy: string[];
        medium: string[];
        hard: string[];
    };
    createdAt: string;
    updatedAt: string;
}, {
    resources: {
        label: string;
        href: string;
        sourceNote?: string | undefined;
    }[];
    title: string;
    summary: string;
    id: string;
    sections: {
        content: string;
        heading: string;
    }[];
    quiz: {
        questions: {
            type: "mcq" | "short_answer" | "true_false";
            prompt: string;
            answer: string | string[];
            explanation: string;
            options?: string[] | undefined;
            id?: string | undefined;
            difficulty?: "easy" | "medium" | "hard" | undefined;
            tags?: string[] | undefined;
        }[];
        memo?: string[] | undefined;
        answers?: string[] | undefined;
    };
    phase: "foundation" | "intermediate" | "senior" | "fet";
    grade: number;
    subjectKey: string;
    term: number;
    week: number;
    version: number;
    topic: string;
    outcomes: string[];
    workedExamples: string[];
    practice: {
        easy?: string[] | undefined;
        medium?: string[] | undefined;
        hard?: string[] | undefined;
    };
    createdAt: string;
    updatedAt: string;
    language?: string | undefined;
}>;
export type LessonV2Content = z.infer<typeof LessonV2Schema>;
//# sourceMappingURL=schema.d.ts.map