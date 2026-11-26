export type LessonLookup = {
    phaseKey: string;
    gradeKey: string;
    subjectKey: string;
    termKey: string;
    weekNumber: number;
};
export declare function getLessonsRoot(): string;
export declare function getLessonFilePath(input: LessonLookup): string | null;
export declare function readLessonMarkdown(input: LessonLookup): {
    markdown: string;
    path: string;
} | null;
//# sourceMappingURL=lessons.d.ts.map