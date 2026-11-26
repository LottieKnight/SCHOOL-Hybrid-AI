/**
 * Pure deadline helpers for the Bursary Finder, split out of the page component
 * so the date logic is unit-testable in a node environment (no DOM).
 *
 * The API sends a date-only 'YYYY-MM-DD' string. A prior bug had it arriving as a
 * full ISO timestamp (the raw pg `date` serialized by Fastify), which the page's
 * `${deadline}T00:00:00` concatenation turned into an Invalid Date — every
 * fixed-deadline bursary rendered "Closes Invalid Date". These helpers parse both
 * shapes defensively; the regression is covered in test/bursaryDeadline.test.ts.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type DeadlineStatus =
  | { kind: "rolling" } // no deadline set
  | { kind: "invalid" } // present but unparseable
  | { kind: "closed" } // deadline already passed
  | { kind: "open"; dateText: string; days: number; urgent: boolean; showCountdown: boolean };

/**
 * Parse a deadline string to a Date. A bare 'YYYY-MM-DD' is interpreted at LOCAL
 * midnight (so day counts are correct in the user's timezone); a full ISO string
 * is parsed as-is.
 */
export function parseDeadline(deadline: string): Date {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(deadline);
  return new Date(dateOnly ? `${deadline}T00:00:00` : deadline);
}

/** Whole days from `now` until the deadline (negative once past). NaN if unparseable. */
export function daysUntil(deadline: string, now: number = Date.now()): number {
  const then = parseDeadline(deadline).getTime();
  if (Number.isNaN(then)) return Number.NaN;
  return Math.ceil((then - now) / MS_PER_DAY);
}

/**
 * Resolve a deadline into the display state the badge renders. `now` is injectable
 * for deterministic tests.
 */
export function deadlineStatus(deadline: string | null, now: number = Date.now()): DeadlineStatus {
  if (!deadline) return { kind: "rolling" };
  const parsed = parseDeadline(deadline);
  if (Number.isNaN(parsed.getTime())) return { kind: "invalid" };

  const days = daysUntil(deadline, now);
  if (days < 0) return { kind: "closed" };

  const dateText = parsed.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return { kind: "open", dateText, days, urgent: days <= 14, showCountdown: days <= 60 };
}
