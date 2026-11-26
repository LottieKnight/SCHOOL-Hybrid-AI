import { describe, expect, it } from "vitest";
import { mapPhasePathToLearnPath } from "../lib/routing";

describe("mapPhasePathToLearnPath", () => {
  it("returns null for non-legacy paths", () => {
    expect(mapPhasePathToLearnPath("/learn/foundation")).toBeNull();
  });

  it("returns null for root path", () => {
    expect(mapPhasePathToLearnPath("/")).toBeNull();
  });

  it("maps legacy phase/grade/subject term-week routes", () => {
    const mapped = mapPhasePathToLearnPath(
      "/phase/foundation/grade/1/group/languages/subject/english-home-language/term/1/week/2"
    );
    expect(mapped).toBe("/learn/foundation/grade-01/english-home-language/term/1/week/2");
  });

  it("merges child subject segments into canonical subject key", () => {
    const mapped = mapPhasePathToLearnPath(
      "/phase/foundation/grade/3/group/maths/subject/mathematics/child/algebra/term/2/week/4"
    );
    expect(mapped).toBe("/learn/foundation/grade-03/mathematics__algebra/term/2/week/4");
  });

  it("normalizes Grade R to grade-00", () => {
    const mapped = mapPhasePathToLearnPath(
      "/phase/foundation/grade/R/group/languages/subject/english-home-language/term/1/week/1"
    );
    expect(mapped).toBe("/learn/foundation/grade-00/english-home-language/term/1/week/1");
  });

  it("pads double-digit grade correctly", () => {
    const mapped = mapPhasePathToLearnPath(
      "/phase/senior/grade/12/group/maths/subject/mathematics/term/4/week/3"
    );
    expect(mapped).toBe("/learn/senior/grade-12/mathematics/term/4/week/3");
  });

  it("passes through a grade-XX slug unchanged", () => {
    const mapped = mapPhasePathToLearnPath(
      "/phase/senior/grade/grade-10/group/maths/subject/mathematics/term/3/week/1"
    );
    expect(mapped).toBe("/learn/senior/grade-10/mathematics/term/3/week/1");
  });

  it("uses grade-<label> for non-numeric grade labels", () => {
    const mapped = mapPhasePathToLearnPath(
      "/phase/senior/grade/special/group/maths/subject/mathematics/term/1/week/1"
    );
    expect(mapped).toBe("/learn/senior/grade-special/mathematics/term/1/week/1");
  });

  it("strips non-digit characters from term and week values", () => {
    const mapped = mapPhasePathToLearnPath(
      "/phase/foundation/grade/1/group/languages/subject/english-home-language/term/1a/week/2b"
    );
    expect(mapped).toBe("/learn/foundation/grade-01/english-home-language/term/1/week/2");
  });

  it("builds path with phase only when grade is absent", () => {
    const mapped = mapPhasePathToLearnPath(
      "/phase/foundation/group/maths/subject/mathematics/term/1/week/1"
    );
    expect(mapped).toBe("/learn/foundation/mathematics/term/1/week/1");
  });

  it("omits term and week when not present", () => {
    const mapped = mapPhasePathToLearnPath(
      "/phase/intermediate/grade/4/group/sciences/subject/life-sciences"
    );
    expect(mapped).toBe("/learn/intermediate/grade-04/life-sciences");
  });

  it("returns phase-only path when only phase is in the URL", () => {
    const mapped = mapPhasePathToLearnPath("/phase/senior");
    expect(mapped).toBe("/learn/senior");
  });
});
