import { describe, expect, it } from "vitest";
import { computeDetailedReportValue } from "../lib/pastPapers/reportValue";

describe("computeDetailedReportValue", () => {
  it("computes attempt comparison, improvement delta, weakest domain, and readiness index", () => {
    const value = computeDetailedReportValue({
      questions: [
        {
          id: "q1",
          qNumber: "1",
          maxMarks: 10,
          section: "Algebra",
          topicTags: null,
        },
        {
          id: "q2",
          qNumber: "2",
          maxMarks: 10,
          section: "Geometry",
          topicTags: null,
        },
      ],
      perQuestion: {
        q1: { score: 4, maxMarks: 10, needsReview: true },
        q2: { score: 8, maxMarks: 10, needsReview: false },
      },
      totalScore: 12,
      totalMax: 20,
      previousAttempt: {
        id: "attempt-prev",
        totalScore: 10,
        totalMax: 20,
      },
    });

    expect(value.attemptComparison.previousAttemptId).toBe("attempt-prev");
    expect(value.attemptComparison.currentPercent).toBe(60);
    expect(value.attemptComparison.previousPercent).toBe(50);
    expect(value.improvementDeltaPercent).toBe(10);
    expect(value.attemptComparison.trend).toBe("improved");
    expect(value.weakestDomain?.domain).toBe("Algebra");
    expect(value.readinessIndex).toBeGreaterThanOrEqual(0);
    expect(value.readinessIndex).toBeLessThanOrEqual(100);
  });

  it("returns 0 currentPercent when totalMax is 0 or invalid", () => {
    const value = computeDetailedReportValue({
      questions: [],
      perQuestion: {},
      totalScore: 10,
      totalMax: 0,
      previousAttempt: null,
    });
    expect(value.attemptComparison.currentPercent).toBe(0);
    expect(value.readinessIndex).toBe(0);
  });

  it("assigns General domain to questions with no section or topicTags", () => {
    const value = computeDetailedReportValue({
      questions: [{ id: "q1", qNumber: "1", maxMarks: 5, section: null, topicTags: null }],
      perQuestion: { q1: { score: 3, maxMarks: 5, needsReview: false } },
      totalScore: 3,
      totalMax: 5,
      previousAttempt: null,
    });
    expect(value.weakestDomain?.domain).toBe("General");
  });

  it("returns baseline trend when previous attempt is missing", () => {
    const value = computeDetailedReportValue({
      questions: [
        {
          id: "q1",
          qNumber: "1",
          maxMarks: 5,
          section: null,
          topicTags: "Functions, Graphs",
        },
      ],
      perQuestion: {
        q1: { score: 3, maxMarks: 5, needsReview: false },
      },
      totalScore: 3,
      totalMax: 5,
      previousAttempt: null,
    });

    expect(value.attemptComparison.previousAttemptId).toBeNull();
    expect(value.attemptComparison.trend).toBe("baseline");
    expect(value.improvementDeltaPercent).toBeNull();
    expect(value.weakestDomain?.domain).toBe("Functions");
  });
});
