import { buildLearnWeekHrefFromLessonKey } from "@/lib/nextBestAction";

export type WeaknessRecommendation = {
  lessonKey: string;
  subject: string;
  grade: number;
  avgScore: number;
  attempts: number;
  reason: string;
};

export type WeaknessReview = {
  subject: string;
  status?: string;
};

export type LearnerWeakness = {
  id: string;
  subject: string;
  grade: number;
  score: number;
  attempts: number;
  lessonKey: string | null;
  reason: string;
  reviewCount: number;
  severity: "focus" | "watch";
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
};

export function buildWeaknessMap(
  recommendations: WeaknessRecommendation[] = [],
  dueReviews: WeaknessReview[] = []
): LearnerWeakness[] {
  const reviewsBySubject = new Map<string, number>();
  for (const review of dueReviews) {
    if (review.status === "done" || review.status === "dismissed") continue;
    const key = review.subject.trim().toLowerCase();
    reviewsBySubject.set(key, (reviewsBySubject.get(key) ?? 0) + 1);
  }

  return recommendations
    .filter((item) => item.subject.trim() && Number.isFinite(Number(item.avgScore)))
    .map((item) => {
      const score = Math.max(0, Math.min(100, Math.round(Number(item.avgScore))));
      const subjectKey = item.subject.trim().toLowerCase();
      const reviewCount = reviewsBySubject.get(subjectKey) ?? 0;
      const lessonHref = buildLearnWeekHrefFromLessonKey(item.lessonKey);
      const primaryHref = lessonHref ?? "/past-papers";

      return {
        id: `${item.lessonKey}-${subjectKey}-${item.grade}`,
        subject: item.subject,
        grade: item.grade,
        score,
        attempts: Math.max(0, Number(item.attempts) || 0),
        lessonKey: item.lessonKey || null,
        reason: item.reason || "Recent evidence shows this area needs another focused attempt.",
        reviewCount,
        severity: score < 50 || reviewCount > 0 ? "focus" : "watch",
        primaryHref,
        primaryLabel: lessonHref ? "Review the lesson" : "Open targeted practice",
        secondaryHref: `/tutor?subject=${encodeURIComponent(item.subject)}`,
      } satisfies LearnerWeakness;
    })
    .sort((left, right) => {
      const severityDelta = Number(right.severity === "focus") - Number(left.severity === "focus");
      return severityDelta || left.score - right.score || right.reviewCount - left.reviewCount;
    })
    .slice(0, 6);
}
