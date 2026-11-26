import { describe, test, expect } from "vitest";
import { calculateRequiredMark } from "../utils/gradeCalculator.js";

describe("calculateRequiredMark", () => {
  test("returns required mark to achieve target when current mark is below target", () => {
    // currentMark=30, weight=50%, target=50
    // required = (50 - 30*0.5) / (1 - 0.5) = 35 / 0.5 = 70
    expect(calculateRequiredMark(30, 50, 50)).toBe(70);
  });

  test("returns a low required mark when current mark is well above target", () => {
    // currentMark=80, weight=40%, target=50
    // required = (50 - 80*0.4) / (1 - 0.4) = (50 - 32) / 0.6 = 18 / 0.6 = 30
    expect(calculateRequiredMark(80, 40, 50)).toBe(30);
  });

  test("returns negative when current mark makes target already achieved", () => {
    // currentMark=90, weight=80%, target=50
    // required = (50 - 90*0.8) / (1 - 0.8) = (50 - 72) / 0.2 = -22 / 0.2 = -110
    expect(calculateRequiredMark(90, 80, 50)).toBe(-110);
  });

  test("returns more than 100 when passing is mathematically impossible", () => {
    // currentMark=0, weight=70%, target=50
    // required = (50 - 0) / (1 - 0.7) = 50 / 0.3 ≈ 166.7
    expect(calculateRequiredMark(0, 70, 50)).toBeCloseTo(166.7, 0);
  });

  test("rounds result to one decimal place", () => {
    // currentMark=60, weight=40%, target=50
    // required = (50 - 60*0.4) / 0.6 = (50 - 24) / 0.6 = 26 / 0.6 ≈ 43.333...
    // rounded to 1dp = 43.3
    expect(calculateRequiredMark(60, 40, 50)).toBe(43.3);
  });

  test("handles 10% weighting correctly", () => {
    // currentMark=50, weight=10%, target=60
    // required = (60 - 50*0.1) / (1 - 0.1) = (60 - 5) / 0.9 = 55 / 0.9 ≈ 61.1
    expect(calculateRequiredMark(50, 10, 60)).toBeCloseTo(61.1, 0);
  });

  test("returns 0 required when current mark exactly satisfies the target", () => {
    // currentMark=100, weight=50%, target=50
    // required = (50 - 100*0.5) / (1 - 0.5) = (50 - 50) / 0.5 = 0
    expect(calculateRequiredMark(100, 50, 50)).toBe(0);
  });
});
