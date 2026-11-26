import type { VideoLessonMeta } from "../generated-lessons-v1.js";
export type CapsScaffoldWeek = {
    name: string;
    topic_title: string;
    summary_md?: string;
    outcomes?: string[];
    video_url?: string;
    video?: VideoLessonMeta;
};
export type CapsScaffoldTerm = {
    name: string;
    weeks: CapsScaffoldWeek[];
};
export type CapsScaffoldSubject = {
    name: string;
    terms?: Record<string, CapsScaffoldTerm>;
    children?: Record<string, CapsScaffoldSubject>;
};
export type CapsScaffoldGroup = {
    name: string;
    subjects: Record<string, CapsScaffoldSubject>;
};
export type CapsScaffoldGrade = {
    name: string;
    groups: Record<string, CapsScaffoldGroup>;
};
export type CapsScaffoldPhase = {
    name: string;
    grades: Record<string, CapsScaffoldGrade>;
};
export type CapsScaffold = {
    phases: Record<string, CapsScaffoldPhase>;
};
export declare function getCapsScaffoldPath(): string;
export declare function buildCapsScaffoldFromData(outline: any): CapsScaffold;
export declare function buildCapsScaffoldFromCourseOutline(): CapsScaffold;
export declare function ensureCapsScaffold(): CapsScaffold;
export declare function loadCapsScaffold(): CapsScaffold;
//# sourceMappingURL=caps-scaffold.d.ts.map