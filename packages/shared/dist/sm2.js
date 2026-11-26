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
export function calculateSM2(input) {
    const { quality, repetitions: prevReps, interval: prevInterval, easeFactor: prevEF } = input;
    // Quality rating validation (0-5)
    const q = Math.max(0, Math.min(5, Math.round(quality)));
    let repetitions;
    let interval;
    if (q < 3) {
        repetitions = 0;
        interval = 1;
    }
    else {
        if (prevReps === 0) {
            interval = 1;
        }
        else if (prevReps === 1) {
            interval = 6;
        }
        else {
            interval = Math.round(prevInterval * prevEF);
        }
        repetitions = prevReps + 1;
    }
    // Calculate new Ease Factor
    // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    let easeFactor = prevEF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (easeFactor < 1.3) {
        easeFactor = 1.3;
    }
    // Next review date
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);
    return {
        repetitions,
        interval,
        easeFactor: Number(easeFactor.toFixed(2)),
        nextReviewDate,
        dueDateString: nextReviewDate.toISOString().split("T")[0],
    };
}
export function confidenceToQuality(confidence) {
    switch (confidence) {
        case "again":
            return 1;
        case "hard":
            return 3;
        case "good":
            return 4;
        case "easy":
            return 5;
        default:
            return 3;
    }
}
