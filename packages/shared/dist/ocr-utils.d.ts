export type OcrResult = {
    used: boolean;
    text: string;
    pageTexts: string[];
    error?: string;
};
export declare function isOcrEnabled(): boolean;
export declare function getOcrMaxPages(): number;
export declare function runOcrForPdf(filePath: string, maxPages?: number): Promise<OcrResult>;
//# sourceMappingURL=ocr-utils.d.ts.map