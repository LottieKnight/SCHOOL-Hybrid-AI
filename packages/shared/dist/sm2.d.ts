export type SM2Input = {
    quality: number;
    repetitions: number;
    interval: number;
    easeFactor: number;
};
export type SM2Output = {
    repetitions: number;
    interval: number;
    easeFactor: number;
    nextReviewDate: Date;
    dueDateString: string;
};
/**
 * Calculates next SM-2 interval, repetition count, and ease factor.
 * Quality rating:
 * 0 - Complete blackout
 * 1 - Incorrect response; familiar upon seeing answer
 * 2 - Incorrect response; easy to recall upon seeing answer
 * 3 - Correct response recalled with serious difficulty
 * 4 - Correct response after hesitation
 * 5 - Perfect recall
 */
export declare function calculateSM2(input: SM2Input): SM2Output;
export declare function confidenceToQuality(confidence: "again" | "hard" | "good" | "easy"): number;
//# sourceMappingURL=sm2.d.ts.map