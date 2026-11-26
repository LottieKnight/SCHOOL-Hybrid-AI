import { z } from "zod";
export declare const WeekSchema: z.ZodObject<{
    name: z.ZodString;
    topic_title: z.ZodString;
    summary_md: z.ZodString;
    video_url: z.ZodDefault<z.ZodString>;
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
    quiz: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodBoolean;
        questions: z.ZodArray<z.ZodAny, "many">;
    }, "strip", z.ZodTypeAny, {
        questions: any[];
        enabled: boolean;
    }, {
        questions: any[];
        enabled: boolean;
    }>>;
    content_items: z.ZodDefault<z.ZodArray<z.ZodAny, "many">>;
}, "strip", z.ZodTypeAny, {
    quiz: {
        questions: any[];
        enabled: boolean;
    };
    name: string;
    topic_title: string;
    summary_md: string;
    video_url: string;
    content_items: any[];
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
    name: string;
    topic_title: string;
    summary_md: string;
    quiz?: {
        questions: any[];
        enabled: boolean;
    } | undefined;
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
    video_url?: string | undefined;
    content_items?: any[] | undefined;
}>;
export declare const TermSchema: z.ZodObject<{
    name: z.ZodString;
    weeks: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        topic_title: z.ZodString;
        summary_md: z.ZodString;
        video_url: z.ZodDefault<z.ZodString>;
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
        quiz: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodBoolean;
            questions: z.ZodArray<z.ZodAny, "many">;
        }, "strip", z.ZodTypeAny, {
            questions: any[];
            enabled: boolean;
        }, {
            questions: any[];
            enabled: boolean;
        }>>;
        content_items: z.ZodDefault<z.ZodArray<z.ZodAny, "many">>;
    }, "strip", z.ZodTypeAny, {
        quiz: {
            questions: any[];
            enabled: boolean;
        };
        name: string;
        topic_title: string;
        summary_md: string;
        video_url: string;
        content_items: any[];
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
        name: string;
        topic_title: string;
        summary_md: string;
        quiz?: {
            questions: any[];
            enabled: boolean;
        } | undefined;
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
        video_url?: string | undefined;
        content_items?: any[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    weeks: {
        quiz: {
            questions: any[];
            enabled: boolean;
        };
        name: string;
        topic_title: string;
        summary_md: string;
        video_url: string;
        content_items: any[];
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
    }[];
}, {
    name: string;
    weeks: {
        name: string;
        topic_title: string;
        summary_md: string;
        quiz?: {
            questions: any[];
            enabled: boolean;
        } | undefined;
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
        video_url?: string | undefined;
        content_items?: any[] | undefined;
    }[];
}>;
export declare const SubjectSchema: z.ZodType<any>;
export declare const GroupSchema: z.ZodObject<{
    name: z.ZodString;
    subjects: z.ZodRecord<z.ZodString, z.ZodType<any, z.ZodTypeDef, any>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    subjects: Record<string, any>;
}, {
    name: string;
    subjects: Record<string, any>;
}>;
export declare const GradeSchema: z.ZodObject<{
    name: z.ZodString;
    groups: z.ZodRecord<z.ZodString, z.ZodObject<{
        name: z.ZodString;
        subjects: z.ZodRecord<z.ZodString, z.ZodType<any, z.ZodTypeDef, any>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        subjects: Record<string, any>;
    }, {
        name: string;
        subjects: Record<string, any>;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    groups: Record<string, {
        name: string;
        subjects: Record<string, any>;
    }>;
}, {
    name: string;
    groups: Record<string, {
        name: string;
        subjects: Record<string, any>;
    }>;
}>;
export declare const PhaseSchema: z.ZodObject<{
    name: z.ZodString;
    grades: z.ZodRecord<z.ZodString, z.ZodObject<{
        name: z.ZodString;
        groups: z.ZodRecord<z.ZodString, z.ZodObject<{
            name: z.ZodString;
            subjects: z.ZodRecord<z.ZodString, z.ZodType<any, z.ZodTypeDef, any>>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            subjects: Record<string, any>;
        }, {
            name: string;
            subjects: Record<string, any>;
        }>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        groups: Record<string, {
            name: string;
            subjects: Record<string, any>;
        }>;
    }, {
        name: string;
        groups: Record<string, {
            name: string;
            subjects: Record<string, any>;
        }>;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    grades: Record<string, {
        name: string;
        groups: Record<string, {
            name: string;
            subjects: Record<string, any>;
        }>;
    }>;
}, {
    name: string;
    grades: Record<string, {
        name: string;
        groups: Record<string, {
            name: string;
            subjects: Record<string, any>;
        }>;
    }>;
}>;
export declare const CourseOutlineSchema: z.ZodObject<{
    phases: z.ZodRecord<z.ZodString, z.ZodObject<{
        name: z.ZodString;
        grades: z.ZodRecord<z.ZodString, z.ZodObject<{
            name: z.ZodString;
            groups: z.ZodRecord<z.ZodString, z.ZodObject<{
                name: z.ZodString;
                subjects: z.ZodRecord<z.ZodString, z.ZodType<any, z.ZodTypeDef, any>>;
            }, "strip", z.ZodTypeAny, {
                name: string;
                subjects: Record<string, any>;
            }, {
                name: string;
                subjects: Record<string, any>;
            }>>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            groups: Record<string, {
                name: string;
                subjects: Record<string, any>;
            }>;
        }, {
            name: string;
            groups: Record<string, {
                name: string;
                subjects: Record<string, any>;
            }>;
        }>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        grades: Record<string, {
            name: string;
            groups: Record<string, {
                name: string;
                subjects: Record<string, any>;
            }>;
        }>;
    }, {
        name: string;
        grades: Record<string, {
            name: string;
            groups: Record<string, {
                name: string;
                subjects: Record<string, any>;
            }>;
        }>;
    }>>;
}, "strip", z.ZodTypeAny, {
    phases: Record<string, {
        name: string;
        grades: Record<string, {
            name: string;
            groups: Record<string, {
                name: string;
                subjects: Record<string, any>;
            }>;
        }>;
    }>;
}, {
    phases: Record<string, {
        name: string;
        grades: Record<string, {
            name: string;
            groups: Record<string, {
                name: string;
                subjects: Record<string, any>;
            }>;
        }>;
    }>;
}>;
export type CourseOutline = z.infer<typeof CourseOutlineSchema>;
export declare function loadCourseOutline(): CourseOutline;
//# sourceMappingURL=curriculum.d.ts.map