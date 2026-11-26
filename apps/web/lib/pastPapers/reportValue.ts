type QuestionLite = {
  id: string;
  qNumber: string;
  maxMarks: number | null;
  section?: string | null;
  topicTags?: string | null;
};

type PreviousAttemptLite = {
  id: string;
  totalScore: number | null;
  totalMax: number | null;
} | null;

type PerQuestionEntry = {
  score?: number;
  maxMarks?: number;
  needsReview?: boolean;
};

type PerQuestionMap = Record<string, PerQuestionEntry>;

function toPercent(score: number | null | undefined, max: number | null | undefined) {
  const numericScore = Number(score ?? 0);
  const numericMax = Number(max ?? 0);
  if (!Number.isFinite(numericScore) || !Number.isFinite(numericMax) || numericMax <= 0) {
    return 0;
  }
  return (numericScore / numericMax) * 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeDomain(question: QuestionLite) {
  const section = question.section?.trim();
  if (section) return section;
  const topic = question.topicTags?.split(/[,;|]/)[0]?.trim();
  if (topic) return topic;
  return "General";
}

export function computeDetailedReportValue(input: {
  questions: QuestionLite[];
  perQuestion: PerQuestionMap;
  totalScore: number;
  totalMax: number;
  previousAttempt: PreviousAttemptLite;
}) {
  const currentPercent = toPercent(input.totalScore, input.totalMax);
  const previousPercent = input.previousAttempt
    ? toPercent(input.previousAttempt.totalScore, input.previousAttempt.totalMax)
    : null;

  const improvementDeltaPercent =
    previousPercent === null ? null : Number((currentPercent - previousPercent).toFixed(2));
  const trend =
    previousPercent === null
      ? "baseline"
      : improvementDeltaPercent! > 0.25
        ? "improved"
        : improvementDeltaPercent! < -0.25
          ? "declined"
          : "flat";

  const domainScores = new Map<string, { ratioTotal: number; count: number }>();
  let needsReviewCount = 0;

  for (const question of input.questions) {
    const row = input.perQuestion[question.id] ?? {};
    const maxMarksRaw =
      typeof row.maxMarks === "number" && Number.isFinite(row.maxMarks)
        ? row.maxMarks
        : question.maxMarks ?? 5;
    const maxMarks = maxMarksRaw > 0 ? maxMarksRaw : 5;
    const scoreRaw =
      typeof row.score === "number" && Number.isFinite(row.score) ? row.score : 0;
    const ratio = clamp(scoreRaw / maxMarks, 0, 1);

    const domain = normalizeDomain(question);
    const aggregate = domainScores.get(domain) ?? { ratioTotal: 0, count: 0 };
    aggregate.ratioTotal += ratio;
    aggregate.count += 1;
    domainScores.set(domain, aggregate);

    if (row.needsReview === true) {
      needsReviewCount += 1;
    }
  }

  let weakestDomain:
    | {
        domain: string;
        averagePercent: number;
        questionCount: number;
      }
    | null = null;

  for (const [domain, aggregate] of domainScores.entries()) {
    const averagePercent = aggregate.count > 0 ? (aggregate.ratioTotal / aggregate.count) * 100 : 0;
    if (!weakestDomain || averagePercent < weakestDomain.averagePercent) {
      weakestDomain = {
        domain,
        averagePercent: Number(averagePercent.toFixed(1)),
        questionCount: aggregate.count,
      };
    }
  }

  const reviewPenalty =
    input.questions.length > 0
      ? clamp((needsReviewCount / input.questions.length) * 12, 0, 12)
      : 0;
  const deltaBoost =
    improvementDeltaPercent == null ? 0 : clamp(improvementDeltaPercent * 0.35, -10, 10);
  const readinessIndex = Math.round(clamp(currentPercent + deltaBoost - reviewPenalty, 0, 100));

  return {
    attemptComparison: {
      previousAttemptId: input.previousAttempt?.id ?? null,
      previousPercent:
        previousPercent == null ? null : Number(previousPercent.toFixed(2)),
      currentPercent: Number(currentPercent.toFixed(2)),
      deltaPercent: improvementDeltaPercent,
      trend,
      previousTotalScore: input.previousAttempt?.totalScore ?? null,
      previousTotalMax: input.previousAttempt?.totalMax ?? null,
    },
    improvementDeltaPercent,
    weakestDomain,
    readinessIndex,
    computedAt: new Date().toISOString(),
  };
}
