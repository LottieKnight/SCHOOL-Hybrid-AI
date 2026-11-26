import { describe, test, expect } from "vitest";
import { daysUntilExam } from "../utils/examCountdown.js";

const BASE_NOW = new Date("2026-05-18T08:00:00.000Z").getTime();

describe("daysUntilExam", () => {
  test("returns 1 for an exam one second in the future", () => {
    const exam = new Date(BASE_NOW + 1000).toISOString();
    expect(daysUntilExam(exam, BASE_NOW)).toBe(1);
  });

  test("returns 1 for an exam exactly 24 hours away", () => {
    const exam = new Date(BASE_NOW + 24 * 60 * 60 * 1000).toISOString();
    expect(daysUntilExam(exam, BASE_NOW)).toBe(1);
  });

  test("returns 7 for an exam that is 6.67 days away", () => {
    // 2026-05-25T00:00:00Z is 6 days + 16 hours after BASE_NOW (2026-05-18T08:00Z)
    expect(daysUntilExam("2026-05-25T00:00:00.000Z", BASE_NOW)).toBe(7);
  });

  test("returns exact day count for a whole number of days", () => {
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
    const exam = new Date(BASE_NOW + fiveDaysMs).toISOString();
    expect(daysUntilExam(exam, BASE_NOW)).toBe(5);
  });

  test("returns a negative number for an exam already passed", () => {
    const exam = new Date(BASE_NOW - 3 * 24 * 60 * 60 * 1000).toISOString();
    const days = daysUntilExam(exam, BASE_NOW);
    expect(days).toBeLessThan(0);
  });

  test("uses Date.now() as default when now is omitted", () => {
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const days = daysUntilExam(futureDate);
    expect(days).toBeGreaterThan(0);
    expect(days).toBeLessThanOrEqual(11);
  });

  test("marks an exam as urgent (≤14 days) when 14 days away", () => {
    const exam = new Date(BASE_NOW + 14 * 24 * 60 * 60 * 1000).toISOString();
    const days = daysUntilExam(exam, BASE_NOW);
    expect(days).toBeLessThanOrEqual(14);
  });

  test("marks an exam as not urgent when more than 14 days away", () => {
    const exam = new Date(BASE_NOW + 15 * 24 * 60 * 60 * 1000).toISOString();
    const days = daysUntilExam(exam, BASE_NOW);
    expect(days).toBeGreaterThan(14);
  });
});
