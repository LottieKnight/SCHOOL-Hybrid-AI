import { describe, expect, it } from "vitest";
import { getCurrentPeriod } from "../lib/academicPeriod";

describe("getCurrentPeriod", () => {
  it("calculates the current term week inside a school term", () => {
    const period = getCurrentPeriod("term", new Date("2026-01-07T10:00:00+02:00"));
    expect(period).toMatchObject({
      format: "term",
      periodNumber: 1,
      weekNumber: 1,
      label: "Term 1 · Week 1",
    });
  });

  it("returns the upcoming term at week 0 during a term break", () => {
    const period = getCurrentPeriod("term", new Date("2026-03-20T10:00:00+02:00"));
    expect(period).toMatchObject({
      format: "term",
      periodNumber: 2,
      weekNumber: 0,
      label: "Term 2 · Week 0",
    });
  });

  it("calculates the semester week inside a university period", () => {
    const period = getCurrentPeriod("semester", new Date("2026-03-16T10:00:00+02:00"));
    expect(period).toMatchObject({
      format: "semester",
      periodNumber: 1,
      weekNumber: 7,
      label: "Sem 1 · Week 7",
    });
  });

  it("returns the upcoming semester at week 0 during the mid-year gap", () => {
    const period = getCurrentPeriod("semester", new Date("2026-06-15T10:00:00+02:00"));
    expect(period).toMatchObject({
      format: "semester",
      periodNumber: 2,
      weekNumber: 0,
      label: "Sem 2 · Week 0",
    });
  });

  it("calculates the current trimester correctly", () => {
    const period = getCurrentPeriod("trimester", new Date("2026-09-14T10:00:00+02:00"));
    expect(period).toMatchObject({
      format: "trimester",
      periodNumber: 3,
      weekNumber: 2,
      label: "Tri 3 · Week 2",
    });
  });

  it("returns the upcoming trimester at week 0 during a gap", () => {
    const period = getCurrentPeriod("trimester", new Date("2026-04-28T10:00:00+02:00"));
    expect(period).toMatchObject({
      format: "trimester",
      periodNumber: 2,
      weekNumber: 0,
      label: "Tri 2 · Week 0",
    });
  });

  it("calculates the current quarter correctly", () => {
    const period = getCurrentPeriod("quarter", new Date("2026-10-12T10:00:00+02:00"));
    expect(period).toMatchObject({
      format: "quarter",
      periodNumber: 4,
      weekNumber: 2,
      label: "Q4 · Week 2",
    });
  });

  it("returns quarter 1 at week 0 before the first Monday anchor", () => {
    const period = getCurrentPeriod("quarter", new Date("2026-01-01T10:00:00+02:00"));
    expect(period).toMatchObject({
      format: "quarter",
      periodNumber: 1,
      weekNumber: 0,
      label: "Q1 · Week 0",
    });
  });
});
