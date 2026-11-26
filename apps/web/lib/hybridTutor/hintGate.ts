import type { HintPayload } from "./schemas";

export type HintReveal = {
  hintsShown: number;
  solutionAsked: boolean;
  answerAsked: boolean;
};

export const CLOSED_REVEAL: HintReveal = {
  hintsShown: 0,
  solutionAsked: false,
  answerAsked: false,
};

export function canRevealFinalAnswer(reveal: HintReveal): boolean {
  return reveal.hintsShown >= 3 && reveal.answerAsked;
}

export type VisibleHint = {
  topic: string;
  hints: string[];
  solution: string | null;
  final_answer: string | null;
  hintsRemaining: number;
  canAskForSolution: boolean;
  canAskForAnswer: boolean;
};

/** Hint-first view. The final answer is omitted until the learner asks after all three hints. */
export function projectHintView(full: HintPayload, reveal: HintReveal): VisibleHint {
  const shown = Math.max(0, Math.min(3, reveal.hintsShown));
  const answerReady = canRevealFinalAnswer({ ...reveal, hintsShown: shown });
  return {
    topic: full.topic,
    hints: full.hints.slice(0, shown),
    solution: reveal.solutionAsked && shown >= 1 ? full.solution : null,
    final_answer: answerReady ? full.final_answer : null,
    hintsRemaining: 3 - shown,
    canAskForSolution: shown >= 1 && !reveal.solutionAsked,
    canAskForAnswer: shown >= 3 && !reveal.answerAsked,
  };
}
