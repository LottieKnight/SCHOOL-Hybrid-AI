import { z } from "zod";
export declare const VideoChapterSchema: z.ZodObject<{
    title: z.ZodString;
    startSeconds: z.ZodNumber;
    endSeconds: z.ZodOptional<z.ZodNumber>;
    summary: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    startSeconds: number;
    endSeconds?: number | undefined;
    summary?: string | undefined;
}, {
    title: string;
    startSeconds: number;
    endSeconds?: number | undefined;
    summary?: string | undefined;
}>;
export declare const VideoLessonMetaSchema: z.ZodObject<{
    videoUrl: z.ZodString;
    thumbnailUrl: z.ZodOptional<z.ZodString>;
    durationSeconds: z.ZodOptional<z.ZodNumber>;
    provider: z.ZodDefault<z.ZodEnum<["heygen", "elevenlabs", "youtube", "vimeo", "other"]>>;
    transcript: z.ZodOptional<z.ZodString>;
    chapters: z.ZodOptional<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        startSeconds: z.ZodNumber;
        endSeconds: z.ZodOptional<z.ZodNumber>;
        summary: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        startSeconds: number;
        endSeconds?: number | undefined;
        summary?: string | undefined;
    }, {
        title: string;
        startSeconds: number;
        endSeconds?: number | undefined;
        summary?: string | undefined;
    }>, "many">>;
    captionsUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    videoUrl: string;
    provider: "other" | "heygen" | "elevenlabs" | "youtube" | "vimeo";
    thumbnailUrl?: string | undefined;
    durationSeconds?: number | undefined;
    transcript?: string | undefined;
    chapters?: {
        title: string;
        startSeconds: number;
        endSeconds?: number | undefined;
        summary?: string | undefined;
    }[] | undefined;
    captionsUrl?: string | undefined;
}, {
    videoUrl: string;
    thumbnailUrl?: string | undefined;
    durationSeconds?: number | undefined;
    provider?: "other" | "heygen" | "elevenlabs" | "youtube" | "vimeo" | undefined;
    transcript?: string | undefined;
    chapters?: {
        title: string;
        startSeconds: number;
        endSeconds?: number | undefined;
        summary?: string | undefined;
    }[] | undefined;
    captionsUrl?: string | undefined;
}>;
export type VideoLessonMeta = z.infer<typeof VideoLessonMetaSchema>;
export type VideoChapter = z.infer<typeof VideoChapterSchema>;
export declare const LessonV1CitationSchema: z.ZodObject<{
    source_path: z.ZodString;
    page_start: z.ZodNumber;
    page_end: z.ZodNumber;
    snippet_hash: z.ZodString;
}, "strip", z.ZodTypeAny, {
    source_path: string;
    page_start: number;
    page_end: number;
    snippet_hash: string;
}, {
    source_path: string;
    page_start: number;
    page_end: number;
    snippet_hash: string;
}>;
export declare const LessonV1SectionSchema: z.ZodObject<{
    heading: z.ZodString;
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
    heading: string;
}, {
    content: string;
    heading: string;
}>;
export declare const LessonV1QuizQuestionSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<["mcq", "short_answer"]>;
    prompt: z.ZodString;
    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    answer: z.ZodString;
    explanation: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "mcq" | "short_answer";
    id: string;
    prompt: string;
    answer: string;
    explanation: string;
    options?: string[] | undefined;
}, {
    type: "mcq" | "short_answer";
    id: string;
    prompt: string;
    answer: string;
    explanation: string;
    options?: string[] | undefined;
}>;
export declare const LessonV1Schema: z.ZodObject<{
    title: z.ZodString;
    summary: z.ZodString;
    objectives: z.ZodArray<z.ZodString, "many">;
    sections: z.ZodObject<{
        explanation: z.ZodArray<z.ZodObject<{
            heading: z.ZodString;
            content: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            content: string;
            heading: string;
        }, {
            content: string;
            heading: string;
        }>, "many">;
        worked_examples: z.ZodArray<z.ZodObject<{
            heading: z.ZodString;
            content: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            content: string;
            heading: string;
        }, {
            content: string;
            heading: string;
        }>, "many">;
        guided_practice: z.ZodArray<z.ZodObject<{
            heading: z.ZodString;
            content: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            content: string;
            heading: string;
        }, {
            content: string;
            heading: string;
        }>, "many">;
        independent_practice: z.ZodArray<z.ZodObject<{
            heading: z.ZodString;
            content: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            content: string;
            heading: string;
        }, {
            content: string;
            heading: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        explanation: {
            content: string;
            heading: string;
        }[];
        worked_examples: {
            content: string;
            heading: string;
        }[];
        guided_practice: {
            content: string;
            heading: string;
        }[];
        independent_practice: {
            content: string;
            heading: string;
        }[];
    }, {
        explanation: {
            content: string;
            heading: string;
        }[];
        worked_examples: {
            content: string;
            heading: string;
        }[];
        guided_practice: {
            content: string;
            heading: string;
        }[];
        independent_practice: {
            content: string;
            heading: string;
        }[];
    }>;
    quiz: z.ZodObject<{
        questions: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodEnum<["mcq", "short_answer"]>;
            prompt: z.ZodString;
            options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            answer: z.ZodString;
            explanation: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "mcq" | "short_answer";
            id: string;
            prompt: string;
            answer: string;
            explanation: string;
            options?: string[] | undefined;
        }, {
            type: "mcq" | "short_answer";
            id: string;
            prompt: string;
            answer: string;
            explanation: string;
            options?: string[] | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        questions: {
            type: "mcq" | "short_answer";
            id: string;
            prompt: string;
            answer: string;
            explanation: string;
            options?: string[] | undefined;
        }[];
    }, {
        questions: {
            type: "mcq" | "short_answer";
            id: string;
            prompt: string;
            answer: string;
            explanation: string;
            options?: string[] | undefined;
        }[];
    }>;
    teacher_notes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    citations: z.ZodArray<z.ZodObject<{
        source_path: z.ZodString;
        page_start: z.ZodNumber;
        page_end: z.ZodNumber;
        snippet_hash: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        source_path: string;
        page_start: number;
        page_end: number;
        snippet_hash: string;
    }, {
        source_path: string;
        page_start: number;
        page_end: number;
        snippet_hash: string;
    }>, "many">;
    video: z.ZodOptional<z.ZodObject<{
        videoUrl: z.ZodString;
        thumbnailUrl: z.ZodOptional<z.ZodString>;
        durationSeconds: z.ZodOptional<z.ZodNumber>;
        provider: z.ZodDefault<z.ZodEnum<["heygen", "elevenlabs", "youtube", "vimeo", "other"]>>;
        transcript: z.ZodOptional<z.ZodString>;
        chapters: z.ZodOptional<z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            startSeconds: z.ZodNumber;
            endSeconds: z.ZodOptional<z.ZodNumber>;
            summary: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            title: string;
            startSeconds: number;
            endSeconds?: number | undefined;
            summary?: string | undefined;
        }, {
            title: string;
            startSeconds: number;
            endSeconds?: number | undefined;
            summary?: string | undefined;
        }>, "many">>;
        captionsUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        videoUrl: string;
        provider: "other" | "heygen" | "elevenlabs" | "youtube" | "vimeo";
        thumbnailUrl?: string | undefined;
        durationSeconds?: number | undefined;
        transcript?: string | undefined;
        chapters?: {
            title: string;
            startSeconds: number;
            endSeconds?: number | undefined;
            summary?: string | undefined;
        }[] | undefined;
        captionsUrl?: string | undefined;
    }, {
        videoUrl: string;
        thumbnailUrl?: string | undefined;
        durationSeconds?: number | undefined;
        provider?: "other" | "heygen" | "elevenlabs" | "youtube" | "vimeo" | undefined;
        transcript?: string | undefined;
        chapters?: {
            title: string;
            startSeconds: number;
            endSeconds?: number | undefined;
            summary?: string | undefined;
        }[] | undefined;
        captionsUrl?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    summary: string;
    objectives: string[];
    sections: {
        explanation: {
            content: string;
            heading: string;
        }[];
        worked_examples: {
            content: string;
            heading: string;
        }[];
        guided_practice: {
            content: string;
            heading: string;
        }[];
        independent_practice: {
            content: string;
            heading: string;
        }[];
    };
    quiz: {
        questions: {
            type: "mcq" | "short_answer";
            id: string;
            prompt: string;
            answer: string;
            explanation: string;
            options?: string[] | undefined;
        }[];
    };
    citations: {
        source_path: string;
        page_start: number;
        page_end: number;
        snippet_hash: string;
    }[];
    teacher_notes?: string[] | undefined;
    video?: {
        videoUrl: string;
        provider: "other" | "heygen" | "elevenlabs" | "youtube" | "vimeo";
        thumbnailUrl?: string | undefined;
        durationSeconds?: number | undefined;
        transcript?: string | undefined;
        chapters?: {
            title: string;
            startSeconds: number;
            endSeconds?: number | undefined;
            summary?: string | undefined;
        }[] | undefined;
        captionsUrl?: string | undefined;
    } | undefined;
}, {
    title: string;
    summary: string;
    objectives: string[];
    sections: {
        explanation: {
            content: string;
            heading: string;
        }[];
        worked_examples: {
            content: string;
            heading: string;
        }[];
        guided_practice: {
            content: string;
            heading: string;
        }[];
        independent_practice: {
            content: string;
            heading: string;
        }[];
    };
    quiz: {
        questions: {
            type: "mcq" | "short_answer";
            id: string;
            prompt: string;
            answer: string;
            explanation: string;
            options?: string[] | undefined;
        }[];
    };
    citations: {
        source_path: string;
        page_start: number;
        page_end: number;
        snippet_hash: string;
    }[];
    teacher_notes?: string[] | undefined;
    video?: {
        videoUrl: string;
        thumbnailUrl?: string | undefined;
        durationSeconds?: number | undefined;
        provider?: "other" | "heygen" | "elevenlabs" | "youtube" | "vimeo" | undefined;
        transcript?: string | undefined;
        chapters?: {
            title: string;
            startSeconds: number;
            endSeconds?: number | undefined;
            summary?: string | undefined;
        }[] | undefined;
        captionsUrl?: string | undefined;
    } | undefined;
}>;
export type LessonV1 = z.infer<typeof LessonV1Schema>;
export type GeneratedLessonLookup = {
    phase: string;
    grade: number | string;
    subjectKey: string;
    term: number | string;
    week: number | string;
    language?: string;
};
export declare function getGeneratedLessonRoot(): string;
export declare function getGeneratedLessonPath(input: GeneratedLessonLookup): string | null;
export declare function readGeneratedLesson(input: GeneratedLessonLookup): {
    title: string;
    summary: string;
    objectives: string[];
    sections: {
        explanation: {
            content: string;
            heading: string;
        }[];
        worked_examples: {
            content: string;
            heading: string;
        }[];
        guided_practice: {
            content: string;
            heading: string;
        }[];
        independent_practice: {
            content: string;
            heading: string;
        }[];
    };
    quiz: {
        questions: {
            type: "mcq" | "short_answer";
            id: string;
            prompt: string;
            answer: string;
            explanation: string;
            options?: string[] | undefined;
        }[];
    };
    citations: {
        source_path: string;
        page_start: number;
        page_end: number;
        snippet_hash: string;
    }[];
    teacher_notes?: string[] | undefined;
    video?: {
        videoUrl: string;
        provider: "other" | "heygen" | "elevenlabs" | "youtube" | "vimeo";
        thumbnailUrl?: string | undefined;
        durationSeconds?: number | undefined;
        transcript?: string | undefined;
        chapters?: {
            title: string;
            startSeconds: number;
            endSeconds?: number | undefined;
            summary?: string | undefined;
        }[] | undefined;
        captionsUrl?: string | undefined;
    } | undefined;
} | null;
export type UniversityLessonLookup = {
    institution: string;
    faculty: string;
    course: string;
    yearOfStudy: number | string;
    moduleCode: string;
};
export declare function getGeneratedUniversityLessonPath(input: UniversityLessonLookup): string | null;
export declare function readGeneratedUniversityLesson(input: UniversityLessonLookup): LessonV1 | null;
//# sourceMappingURL=generated-lessons-v1.d.ts.map