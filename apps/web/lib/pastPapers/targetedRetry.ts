export type RetryQuestionInput = {
  id: string;
  qNumber: string;
  label: string;
  maxMarks: number | null;
  section?: string | null;
  topicTags?: string | null;
  orderIndex: number;
};

export type RetryScore = {
  score?: number | null;
  maxMarks?: number | null;
  reviewerScore?: number | null;
};

export type MissedQuestionSignal = {
  questionId: string;
  qNumber: string;
  label: string;
  concept: string;
  scorePercent: number;
  section: string | null;
  reason: "missed" | "partial";
};

export type TargetedRetryQuestion = RetryQuestionInput & {
  concept: string;
  scorePercent: number;
  selectionReason: string;
};

export type TargetedRetrySet = {
  questions: TargetedRetryQuestion[];
  missedSignals: MissedQuestionSignal[];
  focusConcept: string | null;
  summary: string;
};

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function firstConcept(question: RetryQuestionInput) {
  const tag = question.topicTags?.split(/[,;|]/).map((item) => item.trim()).find(Boolean);
  return tag || question.section?.trim() || "General practice";
}

function scoreFor(question: RetryQuestionInput, scores: Record<string, RetryScore>) {
  const row = scores[question.id] ?? {};
  const maxMarks = finiteNumber(row.maxMarks ?? question.maxMarks, 0);
  const rawScore = row.reviewerScore ?? row.score;
  if (maxMarks <= 0 || typeof rawScore !== "number" || !Number.isFinite(rawScore)) return null;
  return Math.max(0, Math.min(100, (rawScore / maxMarks) * 100));
}

export function mapMissedQuestions(
  questions: RetryQuestionInput[],
  scores: Record<string, RetryScore>
): MissedQuestionSignal[] {
  return questions
    .map((question) => {
      const scorePercent = scoreFor(question, scores);
      if (scorePercent === null || scorePercent >= 100) return null;
      return {
        questionId: question.id,
        qNumber: question.qNumber,
        label: question.label,
        concept: firstConcept(question),
        scorePercent: Math.round(scorePercent),
        section: question.section?.trim() || null,
        reason: scorePercent <= 0 ? "missed" : "partial",
      } satisfies MissedQuestionSignal;
    })
    .filter((signal): signal is MissedQuestionSignal => Boolean(signal))
    .sort((left, right) => left.scorePercent - right.scorePercent);
}

export function buildTargetedRetrySet(
  questions: RetryQuestionInput[],
  scores: Record<string, RetryScore>,
  limit = 3
): TargetedRetrySet {
  const missedSignals = mapMissedQuestions(questions, scores);
  if (!missedSignals.length) {
    return {
      questions: [],
      missedSignals: [],
      focusConcept: null,
      summary: "No scored misses were found. Complete another attempt to create a focused retry set.",
    };
  }

  const focusConcept = missedSignals[0].concept;
  const candidates = questions
    .map((question) => {
      const scorePercent = scoreFor(question, scores);
      if (scorePercent === null || scorePercent >= 100) return null;
      const concept = firstConcept(question);
      const focusMatch = concept.toLowerCase() === focusConcept.toLowerCase();
      return {
        ...question,
        concept,
        scorePercent: Math.round(scorePercent),
        selectionReason: focusMatch ? `Same focus concept: ${focusConcept}` : "Lowest-scoring question in this paper",
        focusMatch,
      };
    })
    .filter((question): question is NonNullable<typeof question> => Boolean(question))
    .sort((left, right) => Number(right.focusMatch) - Number(left.focusMatch) || left.scorePercent - right.scorePercent || left.orderIndex - right.orderIndex)
    .slice(0, Math.max(1, limit));

  return {
    questions: candidates.map(({ focusMatch: _focusMatch, ...question }) => question),
    missedSignals,
    focusConcept,
    summary: `A ${candidates.length}-question retry set built around ${focusConcept}. Start with the lowest signal, then check whether the concept moves.`,
  };
}
