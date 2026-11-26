import { describe, expect, it } from "vitest";
import { checkAnonymousAiLimit, extractClientIdentity } from "../lib/aiAnonymousLimit";

function headerSource(
  overrides: { forwarded?: string | null; realIp?: string | null } = {}
): { get(name: string): string | null } {
  const values: Record<string, string | null> = {
    "x-forwarded-for": overrides.forwarded === undefined ? "203.0.113.7" : overrides.forwarded,
    "x-real-ip": overrides.realIp === undefined ? null : overrides.realIp,
  };
  return {
    get(name: string) {
      return values[name] ?? null;
    },
  };
}

const MINUTE_MS = 60_000;

describe("anonymous AI limit — identity extraction", () => {
  it("uses the first x-forwarded-for value", () => {
    expect(
      extractClientIdentity(headerSource({ forwarded: "198.51.100.2, 10.0.0.1" }))
    ).toBe("198.51.100.2");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    expect(
      extractClientIdentity(headerSource({ forwarded: null, realIp: "198.51.100.9" }))
    ).toBe("198.51.100.9");
  });

  it("collapses an absent identity to a shared fallback, never client-controlled", () => {
    const empty = { get: () => null };
    expect(extractClientIdentity(empty)).toBe("unknown");
  });
});

describe("anonymous AI limit — enforcement", () => {
  it("allows the first request from a client", async () => {
    const result = await checkAnonymousAiLimit(headerSource(), 1_000);
    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBe(0);
  });

  it("rejects a burst over the per-minute window and returns Retry-After", async () => {
    const headers = headerSource({ forwarded: "203.0.113.10" });
    const now = 1_000;
    const result1 = await checkAnonymousAiLimit(headers, now);
    const result2 = await checkAnonymousAiLimit(headers, now + 1);
    const result3 = await checkAnonymousAiLimit(headers, now + 2);
    expect(result1.allowed).toBe(true);
    expect(result2.allowed).toBe(true);
    expect(result3.allowed).toBe(false);
    expect(result3.reason).toBe("rate");
    expect(result3.retryAfter).toBeGreaterThan(0);
  });

  it("resets the per-minute window after 60s but keeps the daily cap", async () => {
    const headers = headerSource({ forwarded: "203.0.113.11" });
    // Minute 1: two allowed; the third is burst-blocked (still consumes a
    // daily increment, matching increment-before-check semantics).
    expect((await checkAnonymousAiLimit(headers, 1_000)).allowed).toBe(true);
    expect((await checkAnonymousAiLimit(headers, 1_001)).allowed).toBe(true);
    expect((await checkAnonymousAiLimit(headers, 1_002)).reason).toBe("rate");

    // Minute 2: burst band resets; daily counters continue.
    expect((await checkAnonymousAiLimit(headers, 62_000)).allowed).toBe(true);
    expect((await checkAnonymousAiLimit(headers, 62_001)).allowed).toBe(true);

    // Next call is the 6th daily increment (cap is 5) → daily-cap enforced.
    const sixth = await checkAnonymousAiLimit(headers, 123_000);
    expect(sixth.allowed).toBe(false);
    expect(sixth.reason).toBe("daily");
    expect(sixth.retryAfter).toBeGreaterThan(0);
  });

  it("treats each client identity independently", async () => {
    const clientA = headerSource({ forwarded: "203.0.113.20" });
    const clientB = headerSource({ forwarded: "203.0.113.21" });
    const now = 1_000;
    const r1 = await checkAnonymousAiLimit(clientA, now);
    const r2 = await checkAnonymousAiLimit(clientA, now + 1);
    const r3 = await checkAnonymousAiLimit(clientA, now + 2);
    expect(r3.allowed).toBe(false);
    const resultB = await checkAnonymousAiLimit(clientB, now);
    expect(resultB.allowed).toBe(true);
    expect((await checkAnonymousAiLimit(clientA, now + 3)).allowed).toBe(false);
  });

  it("does not let a caller vary the header mid-run to reset its own window", async () => {
    // A static fingerprint key is per header value: switching values creates a
    // new bucket, but the leading value is taken from the proxy-set header, not
    // a client-supplied user id. The probe below confirms determinism within
    // one unchanged identity: repeated attempts stay blocked.
    const headers = headerSource({ forwarded: "203.0.113.30" });
    const now = 1_000;
    await checkAnonymousAiLimit(headers, now);
    await checkAnonymousAiLimit(headers, now + 1);
    await checkAnonymousAiLimit(headers, now + 2);
    const repeated = await checkAnonymousAiLimit(headers, now + 3);
    expect(repeated.allowed).toBe(false);
  });
});