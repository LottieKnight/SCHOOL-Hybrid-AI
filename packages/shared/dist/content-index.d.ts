export type ContentIndexWeek = {
    hasLessonJson: boolean;
    resourcesCount: number;
    resourceTypes: string[];
};
export type ContentIndexStats = {
    total_week_folders: number;
    weeks_with_json: number;
    weeks_with_resources_only: number;
    phases: number;
    grades: number;
    subjects: number;
};
export type ContentIndex = {
    generated_at: string;
    stats: ContentIndexStats;
    phases: Record<string, {
        grades: Record<string, {
            subjects: Record<string, {
                terms: Record<string, {
                    weeks: Record<string, ContentIndexWeek>;
                }>;
            }>;
        }>;
    }>;
};
export declare function generateContentIndex(repoRoot?: string): Promise<ContentIndex>;
export declare function writeContentIndex(repoRoot?: string): Promise<ContentIndex>;
export declare function summarizeContentIndex(index: ContentIndex | null): ContentIndexStats;
export declare function normalizeGradeKey(grade: string | number): string;
//# sourceMappingURL=content-index.d.ts.map