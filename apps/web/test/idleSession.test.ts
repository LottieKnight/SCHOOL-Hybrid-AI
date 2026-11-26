import { describe, test, expect } from "vitest";
import {
  IDLE_LOGOUT_MS,
  idleStartAction,
  isIdleExpired,
} from "../lib/idleSession.js";

describe("idleStartAction", () => {
  const now = 1_700_000_000_000;

  test("seeds a fresh timestamp when a session becomes active", () => {
    expect(idleStartAction(now)).toEqual({ type: "seed", at: now });
  });

  // Regression: a returning user has a valid 7-day cookie but a stale
  // activity timestamp left over from a previous browser session. Session
  // start must NEVER log them out, or they are trapped in an inescapable
  // /auth?session_expired=true loop (login never refreshes the timestamp).
  test("never logs out on session start, regardless of prior idleness", () => {
    expect(idleStartAction(now).type).toBe("seed");
  });
});

describe("isIdleExpired", () => {
  const now = 1_700_000_000_000;

  test("not expired when activity is recent", () => {
    expect(isIdleExpired(String(now - 60_000), now)).toBe(false);
  });

  test("expired once idle longer than the logout window", () => {
    expect(isIdleExpired(String(now - IDLE_LOGOUT_MS - 1), now)).toBe(true);
  });

  test("treats a missing timestamp as not expired (no false logout)", () => {
    expect(isIdleExpired(null, now)).toBe(false);
  });

  test("treats a corrupt timestamp as not expired", () => {
    expect(isIdleExpired("not-a-number", now)).toBe(false);
  });
});
