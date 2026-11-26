export type ContentChunk = {
    file_path: string;
    pages: string;
    text: string;
    detected_grade: number | null;
    detected_term: number | null;
    detected_subject: string | null;
    language_tokens: string[];
    doc_type: string;
    no_text?: boolean;
};
export type RetrievalFilters = {
    grade?: number;
    term?: number;
    subject?: string;
};
export type RetrievalOptions = {
    topK?: number;
    indexPath?: string;
    filters?: RetrievalFilters;
};
export declare function getDefaultChunksPath(): string;
export declare function loadContentChunks(indexPath?: string): Promise<ContentChunk[]>;
export declare function retrieveChunks(query: string, options?: RetrievalOptions): Promise<ContentChunk[]>;
//# sourceMappingURL=retrieval.d.ts.map