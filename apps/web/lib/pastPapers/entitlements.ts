const parsedDetailedReportCost = Number(
  process.env.PAST_PAPERS_DETAILED_REPORT_CREDITS || 15
);

export const DETAILED_REPORT_CREDIT_COST =
  Number.isFinite(parsedDetailedReportCost) && parsedDetailedReportCost > 0
    ? Math.round(parsedDetailedReportCost)
    : 15;

export function resolveDetailedReportCreditCost(input: {
  apiPriceCredits?: unknown;
  fallback?: number;
}) {
  const fallback =
    Number.isFinite(input.fallback) && Number(input.fallback) > 0
      ? Math.round(Number(input.fallback))
      : DETAILED_REPORT_CREDIT_COST;
  const parsed = Number(input.apiPriceCredits);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

const ENTITLEMENT_KEY = "detailedReport";
export const DETAILED_REPORT_FEATURE_KEY = "detailed-report";

type JsonRecord = Record<string, unknown>;

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

export function parseAttemptAnalytics(raw: string | null | undefined) {
  if (!raw) return {} as JsonRecord;
  try {
    return toRecord(JSON.parse(raw));
  } catch {
    return {} as JsonRecord;
  }
}

export function isDetailedReportUnlocked(analytics: JsonRecord) {
  const entitlements = toRecord(analytics.entitlements);
  const detailed = toRecord(entitlements[ENTITLEMENT_KEY]);
  return detailed.unlocked === true;
}

export function withDetailedReportEntitlement(
  analytics: JsonRecord,
  input: {
    unlockedAtIso: string;
    costCredits: number;
    idempotencyKey: string;
    walletLedgerEntryId?: string | null;
  }
) {
  const entitlements = toRecord(analytics.entitlements);
  const detailed = toRecord(entitlements[ENTITLEMENT_KEY]);
  return {
    ...analytics,
    entitlements: {
      ...entitlements,
      [ENTITLEMENT_KEY]: {
        ...detailed,
        unlocked: true,
        unlockedAt: input.unlockedAtIso,
        costCredits: input.costCredits,
        idempotencyKey: input.idempotencyKey,
        walletLedgerEntryId: input.walletLedgerEntryId ?? null,
      },
    },
  } as JsonRecord;
}

export function sanitizeAnalyticsForClient(
  analytics: JsonRecord,
  detailedReportUnlocked: boolean
) {
  if (detailedReportUnlocked) return analytics;
  const sanitized = { ...analytics } as JsonRecord;
  delete sanitized.perQuestion;
  delete sanitized.memoSnippet;
  delete sanitized.detailedReportValue;
  return sanitized;
}

export function buildDetailedReportIdempotencyKey(input: {
  userId: string;
  attemptId: string;
}) {
  return `past-paper:${DETAILED_REPORT_FEATURE_KEY}:${input.userId}:${input.attemptId}`;
}

export function canUnlockDetailedReport(input: {
  viewerUserId: string | null;
  attemptUserId: string;
  attemptStatus: string;
  analytics: JsonRecord;
}) {
  if (!input.viewerUserId) {
    return { allowed: false as const, reason: "UNAUTHENTICATED" as const };
  }
  if (input.viewerUserId !== input.attemptUserId) {
    return { allowed: false as const, reason: "FORBIDDEN" as const };
  }
  if (input.attemptStatus !== "marked") {
    return { allowed: false as const, reason: "NOT_MARKED" as const };
  }
  if (isDetailedReportUnlocked(input.analytics)) {
    return { allowed: false as const, reason: "ALREADY_UNLOCKED" as const };
  }
  return { allowed: true as const, reason: "OK" as const };
}

export function resolvePastPaperAttemptAccess(input: {
  viewerUserId: string | null;
  attemptUserId: string;
  analytics: JsonRecord;
}) {
  const canViewAttempt =
    Boolean(input.viewerUserId) && input.viewerUserId === input.attemptUserId;
  const detailedReportUnlocked =
    canViewAttempt && isDetailedReportUnlocked(input.analytics);
  return {
    canViewAttempt,
    detailedReportUnlocked,
  };
}
