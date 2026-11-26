export type SubjectAliasInput = {
    phase: string;
    grade: number;
    filename: string;
    folderHints?: string[];
    outlineKeys: string[];
};
export type SubjectAliasResult = {
    subjectKey: string | null;
    confidence: "high" | "none";
    reason: string;
    tokens: string[];
    candidates?: string[];
};
export declare function resolveSubjectKey(input: SubjectAliasInput): SubjectAliasResult;
//# sourceMappingURL=subject-alias.d.ts.map