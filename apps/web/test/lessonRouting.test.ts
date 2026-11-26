import { describe, expect, it } from "vitest";
import {
  buildLessonHref,
  buildSchoolLessonStoragePattern,
  buildUniversityModuleLessonStoragePath,
  validateLessonParams,
} from "../lib/lessonRouting";

describe("buildLessonHref", () => {
  it("builds canonical path for prefixed term/week keys", () => {
    const href = buildLessonHref({
      phase: "foundation",
      grade: "1",
      subject: "mathematics",
      term: "term1",
      week: "week1",
    });
    expect(href).toBe("/phase/foundation/grade/01/mathematics/term/01/week/01");
  });

  it("handles dashed prefixed keys", () => {
    const href = buildLessonHref({
      phase: "senior",
      grade: "7",
      subject: "natural-sciences",
      term: "term-3",
      week: "week-2",
    });
    expect(href).toBe("/phase/senior/grade/07/natural-sciences/term/03/week/02");
  });

  it("supports Grade R as grade 0", () => {
    const validation = validateLessonParams({
      phase: "foundation",
      grade: "R",
      subject: "english-home-language",
      term: "term1",
      week: "week1",
    });
    expect(validation.valid).toBe(true);

    const href = buildLessonHref({
      phase: "foundation",
      grade: "R",
      subject: "english-home-language",
      term: "term1",
      week: "week1",
    });
    expect(href).toBe("/phase/foundation/grade/00/english-home-language/term/01/week/01");
  });

  it("returns # for invalid term", () => {
    const href = buildLessonHref({
      phase: "foundation",
      grade: "1",
      subject: "mathematics",
      term: "termX",
      week: "week1",
    });
    expect(href).toBe("#");
  });

  it("returns # for invalid phase", () => {
    expect(
      buildLessonHref({ phase: "unknown", grade: "1", subject: "mathematics", term: "1", week: "1" })
    ).toBe("#");
  });

  it("returns # for grade above 12", () => {
    expect(
      buildLessonHref({ phase: "senior", grade: "13", subject: "mathematics", term: "1", week: "1" })
    ).toBe("#");
  });

  it("returns # for week 0", () => {
    expect(
      buildLessonHref({ phase: "foundation", grade: "1", subject: "mathematics", term: "1", week: "0" })
    ).toBe("#");
  });

  it("returns # for empty subject", () => {
    expect(
      buildLessonHref({ phase: "foundation", grade: "1", subject: "", term: "1", week: "1" })
    ).toBe("#");
  });

  it("builds the school lesson storage pattern", () => {
    expect(buildSchoolLessonStoragePattern({ grade: "R", subject: "english-home-language" })).toBe(
      "content/lessons/grade-00/english-home-language/term-{term}/week-{week}.json"
    );
  });

  it("builds a university module storage path", () => {
    expect(
      buildUniversityModuleLessonStoragePath(
        {
          institution: "University of Johannesburg",
          faculty: "College of Business and Economics",
          course: "Bachelor of Commerce",
          yearOfStudy: 2,
        },
        "ACCA211"
      )
    ).toBe(
      "content/university-lessons/university-of-johannesburg/college-of-business-and-economics/bachelor-of-commerce/year-02/acca211/lesson.json"
    );
  });
});
