export type ReadinessBand = "building" | "steady" | "ready";
export type EvidenceTone = "gold" | "cyan" | "mint" | "amber";

export type EvidenceScore = {
  label: string;
  value: string;
  detail: string;
  tone: EvidenceTone;
};

export type ReadinessEvidence = {
  score: number;
  band: ReadinessBand;
  bandLabel: string;
  headline: string;
  explanation: string;
  signals: EvidenceScore[];
};

type ScoreInput = { score_percent: number };
type DueReviewInput = { status?: string; id?: string };
type RecommendationInput = { avgScore: number; subject: string };

export function readinessBand(score: number): ReadinessBand {
  if (score >= 75) return "ready";
  if (score >= 55) return "steady";
  return "building";
}

export function buildReadinessEvidence({
  scores = [],
  dueReviews = [],
  recommendations = [],
}: {
  scores?: ScoreInput[];
  dueReviews?: DueReviewInput[];
  recommendations?: RecommendationInput[];
}): ReadinessEvidence {
  const numericScores = scores
    .map((item) => Number(item.score_percent))
    .filter((value) => Number.isFinite(value));
  const average = numericScores.length
    ? numericScores.reduce((sum, value) => sum + value, 0) / numericScores.length
    : null;
  const openReviews = dueReviews.filter((review) => review.status !== "done" && review.status !== "dismissed").length;
  const weakRecommendations = recommendations.filter((item) => Number(item.avgScore) < 60).length;

  // Keep the score explainable: assessment signal first, then recovery pressure.
  const base = average ?? (recommendations.length ? 52 : 35);
  const recoveryAdjustment = Math.min(12, weakRecommendations * 3 + openReviews * 2);
  const score = Math.round(Math.max(0, Math.min(100, base - recoveryAdjustment)));
  const band = readinessBand(score);
  const bandLabel = band === "ready" ? "Ready to stretch" : band === "steady" ? "Steady progress" : "Building your base";

  const signals: EvidenceScore[] = [
    {
      label: "Assessment signal",
      value: average === null ? "No score yet" : `${Math.round(average)}% average`,
      detail: numericScores.length ? `${numericScores.length} recent result${numericScores.length === 1 ? "" : "s"}` : "Complete a quiz or paper to establish a baseline",
      tone: "gold",
    },
    {
      label: "Recovery queue",
      value: openReviews ? `${openReviews} to revisit` : "Clear",
      detail: openReviews ? "Short reviews are waiting for another attempt" : "No overdue review signals detected",
      tone: openReviews ? "amber" : "mint",
    },
    {
      label: "Next leverage",
      value: weakRecommendations ? `${weakRecommendations} weak area${weakRecommendations === 1 ? "" : "s"}` : "Keep momentum",
      detail: recommendations[0]?.subject ? `Start with ${recommendations[0].subject}` : "Your next completed learning action will sharpen this view",
      tone: "cyan",
    },
  ];

  return {
    score,
    band,
    bandLabel,
    headline: band === "ready" ? "Your evidence says stretch" : band === "steady" ? "Your evidence says keep the loop" : "Your evidence says start small",
    explanation: openReviews
      ? "One focused recovery action is more valuable than opening another feature."
      : "The model will become more precise as you complete linked lessons, quizzes, and papers.",
    signals,
  };
}
