export type RagChunk = {
    file_path: string;
    page_start: number;
    page_end: number;
    detected_grade: number | null;
    detected_term: number | null;
    detected_subject_key: string | null;
    language_tokens: string[];
    phase: "foundation" | "intermediate" | "senior" | "fet" | null;
    doc_type: string;
    text: string;
};
export type RagChunkScore = RagChunk & {
    score: number;
};
export type RetrieveParams = {
    phase?: "foundation" | "intermediate" | "senior" | "fet";
    grade?: number;
    subjectKey?: string;
    term?: number;
    week?: number;
    topic?: string;
    k?: number;
    indexPath?: string;
};
export declare function getDefaultRagIndexPath(): string;
export declare function retrieveChunks(params: RetrieveParams): Promise<{
    score: number;
    file_path: string;
    page_start: number;
    page_end: number;
    detected_grade: number | null;
    detected_term: number | null;
    detected_subject_key: string | null;
    language_tokens: string[];
    phase: "foundation" | "intermediate" | "senior" | "fet" | null;
    doc_type: string;
    text: string;
}[]>;
//# sourceMappingURL=retrieval.d.ts.map