import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTutorRankingScore, getReliabilityLabel } from "../src/lib/tutor-ranking.js";

const baseMetrics = {
  avgRating: 4.8,
  ratingCount: 10,
  completedSessionsCount: 12,
  cancellationCountLate: 0,
  noShowCount: 0,
  disputesLostCount: 0,
  offPlatformAttemptsLow: 0,
  offPlatformAttemptsHigh: 0,
  fraudStrikesCount: 0,
  unresolvedDisputesCount: 0,
  createdAt: new Date(),
  deliveryMode: "online" as const,
  hasVerifiedTeacher: true,
  hasVerifiedStudent: false,
  hasVerifiedGraduate: false,
  supportsOnline: true,
  distanceKm: null,
};

test("ranking uses neutral rating when count < 3", () => {
  const score = computeTutorRankingScore({
    ...baseMetrics,
    avgRating: 5,
    ratingCount: 1,
  });
  assert.ok(Math.abs(score.qualityScore - 34) < 0.2);
});

test("reliability score penalties map to labels", () => {
  const score = computeTutorRankingScore({
    ...baseMetrics,
    cancellationCountLate: 2,
    noShowCount: 1,
    disputesLostCount: 1,
  });
  assert.equal(score.reliabilityScore, 10);
  assert.equal(getReliabilityLabel(score.reliabilityScore), "Inconsistent");
});

test("new tutor fairness boost fades by account age", () => {
  const score = computeTutorRankingScore({
    ...baseMetrics,
    completedSessionsCount: 0,
    createdAt: new Date(),
  });
  assert.ok(score.fairnessBoost > 7.5);
});

test("integrity penalty clamps at -30", () => {
  const score = computeTutorRankingScore({
    ...baseMetrics,
    offPlatformAttemptsLow: 4,
    offPlatformAttemptsHigh: 2,
    fraudStrikesCount: 2,
  });
  assert.equal(score.integrityPenalty, -30);
});
