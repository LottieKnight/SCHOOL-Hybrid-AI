import { describe, expect, it } from "vitest";
import {
  buildDetailedReportIdempotencyKey,
  canUnlockDetailedReport,
  DETAILED_REPORT_CREDIT_COST,
  parseAttemptAnalytics,
  resolveDetailedReportCreditCost,
  resolvePastPaperAttemptAccess,
  sanitizeAnalyticsForClient,
  withDetailedReportEntitlement,
} from "../lib/pastPapers/entitlements";

describe("past papers access controls", () => {
  it("does not allow attempt access when viewer does not own attempt", () => {
    const analytics = parseAttemptAnalytics(
      JSON.stringify({
        entitlements: {
          detailedReport: { unlocked: true },
        },
      })
    );
    const access = resolvePastPaperAttemptAccess({
      viewerUserId: "user-aaa",
      attemptUserId: "user-bbb",
      analytics,
    });
    expect(access.canViewAttempt).toBe(false);
    expect(access.detailedReportUnlocked).toBe(false);
  });

  it("keeps detailed report locked until entitlement marker is stored", () => {
    const analytics = parseAttemptAnalytics(
      JSON.stringify({
        perQuestion: { q1: { score: 4, maxMarks: 5 } },
        memoSnippet: "Expected answer structure...",
        detailedReportValue: { readinessIndex: 61 },
      })
    );

    const access = resolvePastPaperAttemptAccess({
      viewerUserId: "user-aaa",
      attemptUserId: "user-aaa",
      analytics,
    });
    expect(access.canViewAttempt).toBe(true);
    expect(access.detailedReportUnlocked).toBe(false);

    const sanitized = sanitizeAnalyticsForClient(analytics, access.detailedReportUnlocked);
    expect(sanitized.perQuestion).toBeUndefined();
    expect(sanitized.memoSnippet).toBeUndefined();
    expect(sanitized.detailedReportValue).toBeUndefined();
  });

  it("unlocks detailed report only with entitlement marker", () => {
    const base = parseAttemptAnalytics("{}");
    const entitled = withDetailedReportEntitlement(base, {
      unlockedAtIso: "2026-02-01T00:00:00.000Z",
      costCredits: DETAILED_REPORT_CREDIT_COST,
      idempotencyKey: "past-paper:detailed-report:user-aaa:attempt-xyz",
      walletLedgerEntryId: "ledger-123",
    });
    const access = resolvePastPaperAttemptAccess({
      viewerUserId: "user-aaa",
      attemptUserId: "user-aaa",
      analytics: entitled,
    });
    expect(access.canViewAttempt).toBe(true);
    expect(access.detailedReportUnlocked).toBe(true);

    const sanitized = sanitizeAnalyticsForClient(entitled, access.detailedReportUnlocked);
    expect(sanitized.entitlements).toBeDefined();
  });

  it("prevents unlock when viewer does not own attempt", () => {
    const access = canUnlockDetailedReport({
      viewerUserId: "user-aaa",
      attemptUserId: "user-bbb",
      attemptStatus: "marked",
      analytics: parseAttemptAnalytics("{}"),
    });
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe("FORBIDDEN");
  });

  it("builds deterministic unlock idempotency key from user, attempt, and feature", () => {
    const key = buildDetailedReportIdempotencyKey({
      userId: "user-aaa",
      attemptId: "attempt-xyz",
    });
    expect(key).toBe("past-paper:detailed-report:user-aaa:attempt-xyz");
  });

  it("changes unlock idempotency key when user or attempt changes", () => {
    const base = buildDetailedReportIdempotencyKey({
      userId: "user-aaa",
      attemptId: "attempt-xyz",
    });
    const differentUser = buildDetailedReportIdempotencyKey({
      userId: "user-bbb",
      attemptId: "attempt-xyz",
    });
    const differentAttempt = buildDetailedReportIdempotencyKey({
      userId: "user-aaa",
      attemptId: "attempt-123",
    });
    expect(base).not.toBe(differentUser);
    expect(base).not.toBe(differentAttempt);
  });

  it("returns empty object for invalid JSON in parseAttemptAnalytics", () => {
    expect(parseAttemptAnalytics("{bad json")).toEqual({});
    expect(parseAttemptAnalytics(null)).toEqual({});
    expect(parseAttemptAnalytics("")).toEqual({});
  });

  it("rejects unlock when viewer is unauthenticated (null userId)", () => {
    const result = canUnlockDetailedReport({
      viewerUserId: null,
      attemptUserId: "user-aaa",
      attemptStatus: "marked",
      analytics: parseAttemptAnalytics("{}"),
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("UNAUTHENTICATED");
  });

  it("rejects unlock when attempt is not yet marked", () => {
    const result = canUnlockDetailedReport({
      viewerUserId: "user-aaa",
      attemptUserId: "user-aaa",
      attemptStatus: "submitted",
      analytics: parseAttemptAnalytics("{}"),
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("NOT_MARKED");
  });

  it("rejects unlock when detailed report is already unlocked", () => {
    const analytics = parseAttemptAnalytics(
      JSON.stringify({ entitlements: { detailedReport: { unlocked: true } } })
    );
    const result = canUnlockDetailedReport({
      viewerUserId: "user-aaa",
      attemptUserId: "user-aaa",
      attemptStatus: "marked",
      analytics,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("ALREADY_UNLOCKED");
  });

  it("allows unlock when all preconditions are met", () => {
    const result = canUnlockDetailedReport({
      viewerUserId: "user-aaa",
      attemptUserId: "user-aaa",
      attemptStatus: "marked",
      analytics: parseAttemptAnalytics("{}"),
    });
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("OK");
  });

  it("uses dynamic detailed report pricing deterministically when price changes", () => {
    const firstPrice = resolveDetailedReportCreditCost({
      apiPriceCredits: 18,
      fallback: DETAILED_REPORT_CREDIT_COST,
    });
    const secondPrice = resolveDetailedReportCreditCost({
      apiPriceCredits: 22,
      fallback: DETAILED_REPORT_CREDIT_COST,
    });

    expect(firstPrice).toBe(18);
    expect(secondPrice).toBe(22);
    expect(firstPrice).not.toBe(secondPrice);
    expect(
      resolveDetailedReportCreditCost({
        apiPriceCredits: 22,
        fallback: DETAILED_REPORT_CREDIT_COST,
      })
    ).toBe(secondPrice);
  });
});
