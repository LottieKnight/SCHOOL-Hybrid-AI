import { describe, expect, it } from "vitest";
import { isFetGrade, schoolFinishHref } from "@/lib/onboardingDestination";

describe("Grade 10-12 finish", () => {
  it("ends on a past paper or the hybrid tutor", () => {
    expect(schoolFinishHref(12, "papers")).toBe("/past-papers?grade=12");
    expect(schoolFinishHref(11, "tutor")).toBe("/tutor?grade=11&subject=Mathematics");
    expect(isFetGrade(10)).toBe(true);
  });

  it("keeps younger grades on their learn page", () => {
    expect(schoolFinishHref(7, "papers")).toBe("/learn/senior/grade-07");
    expect(isFetGrade(7)).toBe(false);
  });
});
