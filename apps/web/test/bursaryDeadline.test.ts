import { describe, test, expect } from "vitest";
import { deadlineStatus, daysUntil, parseDeadline } from "../lib/bursary/deadline.js";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// `now` is always derived from parseDeadline() of the same string, so day-count
// assertions stay exact and independent of the test runner's timezone.
function nowDaysBefore(deadline: string, days: number): number {
  return parseDeadline(deadline).getTime() - days * MS_PER_DAY;
}

describe("deadlineStatus", () => {
  // The regression: a date-only 'YYYY-MM-DD' must render a real date, never the
  // "Invalid Date" string the old `${deadline}T00:00:00`-on-an-ISO-timestamp bug
  // produced.
  test("a known future date-only deadline renders a real date (not 'Invalid Date')", () => {
    const deadline = "2026-09-14";
    const status = deadlineStatus(deadline, nowDaysBefore(deadline, 90));

    expect(status.kind).toBe("open");
    if (status.kind !== "open") throw new Error("expected open");
    expect(status.dateText).not.toBe("Invalid Date");
    expect(status.dateText).toContain("2026");
  });

  // The exact wire value the reviewer captured from the unpatched backend: a pg
  // `date` serialized by Fastify to a full ISO timestamp. It must still resolve
  // to a real, open date rather than Invalid Date.
  test("a legacy full-ISO timestamp deadline still renders a real date", () => {
    const deadline = "2026-09-13T22:00:00.000Z";
    const status = deadlineStatus(deadline, Date.UTC(2026, 0, 1));

    expect(status.kind).toBe("open");
    if (status.kind !== "open") throw new Error("expected open");
    expect(status.dateText).not.toBe("Invalid Date");
    expect(status.dateText).toContain("2026");
  });

  test("a past deadline shows 'Closed'", () => {
    const deadline = "2026-09-14";
    // now is two days AFTER the deadline
    const now = parseDeadline(deadline).getTime() + 2 * MS_PER_DAY;
    expect(deadlineStatus(deadline, now)).toEqual({ kind: "closed" });
  });

  test("a null deadline is rolling", () => {
    expect(deadlineStatus(null)).toEqual({ kind: "rolling" });
  });

  test("an unparseable deadline is invalid", () => {
    expect(deadlineStatus("not-a-date")).toEqual({ kind: "invalid" });
  });

  test("a deadline within 14 days is urgent and shows a countdown", () => {
    const deadline = "2026-09-14";
    const status = deadlineStatus(deadline, nowDaysBefore(deadline, 8));
    expect(status).toMatchObject({ kind: "open", days: 8, urgent: true, showCountdown: true });
  });

  test("urgency boundary: exactly 14 days is urgent, 15 is not", () => {
    const deadline = "2026-09-14";
    const at14 = deadlineStatus(deadline, nowDaysBefore(deadline, 14));
    const at15 = deadlineStatus(deadline, nowDaysBefore(deadline, 15));
    expect(at14).toMatchObject({ kind: "open", urgent: true });
    expect(at15).toMatchObject({ kind: "open", urgent: false });
  });

  test("countdown boundary: shown at 60 days, hidden at 61", () => {
    const deadline = "2026-09-14";
    const at60 = deadlineStatus(deadline, nowDaysBefore(deadline, 60));
    const at61 = deadlineStatus(deadline, nowDaysBefore(deadline, 61));
    expect(at60).toMatchObject({ kind: "open", showCountdown: true });
    expect(at61).toMatchObject({ kind: "open", showCountdown: false });
  });
});

describe("daysUntil", () => {
  test("counts whole days to a future deadline", () => {
    const deadline = "2026-09-14";
    expect(daysUntil(deadline, nowDaysBefore(deadline, 30))).toBe(30);
  });

  test("is negative once the deadline has passed", () => {
    const deadline = "2026-09-14";
    const now = parseDeadline(deadline).getTime() + 3 * MS_PER_DAY;
    expect(daysUntil(deadline, now)).toBe(-3);
  });

  test("is NaN for an unparseable deadline", () => {
    expect(Number.isNaN(daysUntil("garbage", Date.now()))).toBe(true);
  });
});
