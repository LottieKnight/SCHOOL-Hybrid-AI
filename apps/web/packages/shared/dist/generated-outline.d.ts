export type GeneratedOutlineWeek = {
    hasLessonJson: boolean;
    resourcesCount: number;
    resourcesOnly: boolean;
};
export type GeneratedOutlineSubject = {
    displayName: string;
    sourceKey: string;
    terms: Record<string, {
        weeks: Record<string, GeneratedOutlineWeek>;
    }>;
};
export type UnclassifiedSubject = {
    sourceKey: string;
    reason: string;
    terms: Record<string, {
        weeks: Record<string, GeneratedOutlineWeek>;
    }>;
};
export type GeneratedOutline = {
    generated_at: string;
    stats: {
        total_subjects: number;
        unclassified_subjects: number;
        total_week_nodes: number;
    };
    phases: Record<string, {
        grades: Record<string, {
            subjects: Record<string, GeneratedOutlineSubject>;
            unclassified_subjects: UnclassifiedSubject[];
        }>;
    }>;
};
export declare function loadGeneratedOutline(): GeneratedOutline | null;
//# sourceMappingURL=generated-outline.d.ts.map