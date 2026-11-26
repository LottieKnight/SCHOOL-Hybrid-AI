import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/pastPapers/db";
import { getUserContextFromRequest } from "@/lib/pastPapers/auth";
import {
  DETAILED_REPORT_CREDIT_COST,
  buildDetailedReportIdempotencyKey,
  canUnlockDetailedReport,
  parseAttemptAnalytics,
  resolveDetailedReportCreditCost,
  withDetailedReportEntitlement,
} from "@/lib/pastPapers/entitlements";

export const runtime = "nodejs";

const apiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000";

function extractApiError(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as { error?: unknown };
  return typeof candidate.error === "string" ? candidate.error : null;
}

function extractDetailedReportPriceFromWalletPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const pricing = (payload as { pricing?: unknown }).pricing;
  if (!pricing || typeof pricing !== "object") return null;

  const direct = (pricing as { detailedReportCredits?: unknown }).detailedReportCredits;
  if (direct !== undefined) {
    return resolveDetailedReportCreditCost({
      apiPriceCredits: direct,
      fallback: DETAILED_REPORT_CREDIT_COST,
    });
  }

  const nested = (pricing as { featurePrices?: { detailedReportCredits?: unknown } }).featurePrices
    ?.detailedReportCredits;
  if (nested !== undefined) {
    return resolveDetailedReportCreditCost({
      apiPriceCredits: nested,
      fallback: DETAILED_REPORT_CREDIT_COST,
    });
  }

  return null;
}

export async function POST(request: NextRequest) {
  const userContext = await getUserContextFromRequest();
  if (!userContext.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const attemptId = typeof body.attemptId === "string" ? body.attemptId : null;
  if (!attemptId) {
    return NextResponse.json({ error: "Missing attemptId" }, { status: 400 });
  }

  const attempt = await db.findFirst("PastPaperAttempt", {
    where: { id: attemptId },
    select: ["id", "userId", "status", "analyticsJson", "totalScore", "totalMax"],
  });
  if (!attempt || attempt.userId !== userContext.userId) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  const analytics = parseAttemptAnalytics(attempt.analyticsJson as string | null);
  const unlockAccess = canUnlockDetailedReport({
    viewerUserId: userContext.userId,
    attemptUserId: attempt.userId as string,
    attemptStatus: attempt.status as string,
    analytics,
  });

  if (!unlockAccess.allowed && unlockAccess.reason === "ALREADY_UNLOCKED") {
    return NextResponse.json({
      ok: true,
      detailedReportUnlocked: true,
      alreadyUnlocked: true,
      attemptId,
      totalScore: attempt.totalScore,
      totalMax: attempt.totalMax,
    });
  }
  if (!unlockAccess.allowed && unlockAccess.reason === "NOT_MARKED") {
    return NextResponse.json(
      { error: "Attempt must be marked before unlocking detailed report." },
      { status: 409 }
    );
  }
  if (!unlockAccess.allowed) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  const idempotencyKey = buildDetailedReportIdempotencyKey({
    userId: userContext.userId,
    attemptId,
  });

  const csrfToken =
    request.headers.get("x-csrf-token") ||
    request.headers.get("x-csrf") ||
    "";
  const cookieHeader = request.headers.get("cookie") || "";

  let debitAmountCredits = DETAILED_REPORT_CREDIT_COST;
  try {
    const walletBalanceResponse = await fetch(`${apiBase}/wallet/balance`, {
      method: "GET",
      headers: {
        cookie: cookieHeader,
      },
      cache: "no-store",
    });
    if (walletBalanceResponse.ok) {
      const walletBalancePayload = await walletBalanceResponse.json().catch(() => null);
      const dynamicPrice = extractDetailedReportPriceFromWalletPayload(walletBalancePayload);
      if (dynamicPrice) {
        debitAmountCredits = dynamicPrice;
      }
    }
  } catch {
    // Keep fallback price when wallet pricing lookup is unavailable.
  }

  let walletResponse: Response;
  try {
    walletResponse = await fetch(`${apiBase}/wallet/unlocks/detailed-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
        cookie: cookieHeader,
        "idempotency-key": idempotencyKey,
      },
      cache: "no-store",
      body: JSON.stringify({
        attemptId,
        amountCredits: debitAmountCredits,
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "Wallet service unavailable." },
      { status: 503 }
    );
  }

  const walletPayload = await walletResponse.json().catch(() => null);
  if (!walletResponse.ok) {
    return NextResponse.json(
      { error: extractApiError(walletPayload) || "Unable to debit wallet credits." },
      { status: walletResponse.status }
    );
  }

  const chargedCredits =
    walletPayload &&
    typeof walletPayload === "object" &&
    "unlock" in walletPayload &&
    walletPayload.unlock &&
    typeof (walletPayload.unlock as { chargedCredits?: unknown }).chargedCredits === "number"
      ? Math.max(
          0,
          Math.round((walletPayload.unlock as { chargedCredits: number }).chargedCredits)
        )
      : debitAmountCredits;

  const nextAnalytics = withDetailedReportEntitlement(analytics, {
    unlockedAtIso: new Date().toISOString(),
    costCredits: chargedCredits,
    idempotencyKey,
    walletLedgerEntryId:
      walletPayload &&
      typeof walletPayload === "object" &&
      "ledgerEntry" in walletPayload &&
      walletPayload.ledgerEntry &&
      typeof (walletPayload.ledgerEntry as { id?: unknown }).id === "string"
        ? ((walletPayload.ledgerEntry as { id: string }).id as string)
        : null,
  });

  await db.update(
    "PastPaperAttempt",
    { id: attemptId },
    { analyticsJson: JSON.stringify(nextAnalytics) }
  );

  return NextResponse.json({
    ok: true,
    detailedReportUnlocked: true,
    attemptId,
    wallet: walletPayload,
    totalScore: attempt.totalScore,
    totalMax: attempt.totalMax,
  });
}
