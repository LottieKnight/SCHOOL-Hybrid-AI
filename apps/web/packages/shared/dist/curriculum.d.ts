import { z } from "zod";
export declare const WeekSchema: z.ZodObject<{
    name: z.ZodString;
    topic_title: z.ZodString;
    summary_md: z.ZodString;
    video_url: z.ZodDefault<z.ZodString>;
    quiz: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodBoolean;
        questions: z.ZodArray<z.ZodAny, "many">;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        questions: any[];
    }, {
        enabled: boolean;
        questions: any[];
    }>>;
    content_items: z.ZodDefault<z.ZodArray<z.ZodAny, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    topic_title: string;
    summary_md: string;
    video_url: string;
    quiz: {
        enabled: boolean;
        questions: any[];
    };
    content_items: any[];
}, {
    name: string;
    topic_title: string;
    summary_md: string;
    video_url?: string | undefined;
    quiz?: {
        enabled: boolean;
        questions: any[];
    } | undefined;
    content_items?: any[] | undefined;
}>;
export declare const TermSchema: z.ZodObject<{
    name: z.ZodString;
    weeks: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        topic_title: z.ZodString;
        summary_md: z.ZodString;
        video_url: z.ZodDefault<z.ZodString>;
        quiz: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodBoolean;
            questions: z.ZodArray<z.ZodAny, "many">;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            questions: any[];
        }, {
            enabled: boolean;
            questions: any[];
        }>>;
        content_items: z.ZodDefault<z.ZodArray<z.ZodAny, "many">>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        topic_title: string;
        summary_md: string;
        video_url: string;
        quiz: {
            enabled: boolean;
            questions: any[];
        };
        content_items: any[];
    }, {
        name: string;
        topic_title: string;
        summary_md: string;
        video_url?: string | undefined;
        quiz?: {
            enabled: boolean;
            questions: any[];
        } | undefined;
        content_items?: any[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    weeks: {
        name: string;
        topic_title: string;
        summary_md: string;
        video_url: string;
        quiz: {
            enabled: boolean;
            questions: any[];
        };
        content_items: any[];
    }[];
}, {
    name: string;
    weeks: {
        name: string;
        topic_title: string;
        summary_md: string;
        video_url?: string | undefined;
        quiz?: {
            enabled: boolean;
            questions: any[];
        } | undefined;
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