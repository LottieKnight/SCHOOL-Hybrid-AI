export type RagV1Chunk = {
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
export type RagV1ChunkScore = RagV1Chunk & {
    score: number;
};
export type RagV1RetrieveParams = {
    phase?: "foundation" | "intermediate" | "senior" | "fet";
    grade?: number;
    subjectKey?: string;
    term?: number;
    week?: number;
    topic?: string;
    k?: number;
    indexPath?: string;
};
export declare function getDefaultRagV1IndexPath(): string;
export declare function retrieveRagV1Chunks(params: RagV1RetrieveParams): Promise<{
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