import { describe, expect, it } from "vitest";
import { buildLearnWeekHrefFromLessonKey, derivePhaseFromGrade, parseLessonKey } from "../lib/nextBestAction";

describe("nextBestAction lesson key helpers", () => {
  it("parses canonical lesson keys", () => {
    const parsed = parseLessonKey("10-mathematics-02-03");
    expect(parsed).toEqual({
      grade: 10,
      subjectKey: "mathematics",
      term: 2,
      week: 3,
    });
  });

  it("builds learn route href from lesson key", () => {
    const href = buildLearnWeekHrefFromLessonKey("07-natural-sciences-01-05");
    expect(href).toBe("/learn/senior/grade-07/natural-sciences/term/1/week/5");
  });

  it("returns null for malformed lesson keys", () => {
    expect(buildLearnWeekHrefFromLessonKey("bad-key")).toBeNull();
  });

  it("derives phase from grade", () => {
    expect(derivePhaseFromGrade(3)).toBe("foundation");
    expect(derivePhaseFromGrade(6)).toBe("intermediate");
    expect(derivePhaseFromGrade(9)).toBe("senior");
    expect(derivePhaseFromGrade(10)).toBe("fet");
  });
});

