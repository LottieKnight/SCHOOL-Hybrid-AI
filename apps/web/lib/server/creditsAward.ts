import "server-only";

import type { NextRequest } from "next/server";

// Best-effort server-side hook into the Scholar Credits economy.
//
// Calls the Fastify POST /credits/earn endpoint (the authoritative ledger)
// by forwarding the user's session + CSRF cookies. Failures are swallowed on
// purpose: Scholar Credits are a non-critical side effect, and before
// migration 086 is applied to the live database these calls return a 500
// that must never break the host feature (daily quiz, games, planner...).
//
// Amounts are intentionally NOT sent: the ledger is authoritative — since the
// mint fix, earnCredits() in apps/api always applies the CREDIT_RULES amount
// for the source and ignores any client-supplied amount, and /credits/earn
// rejects sources that are not daily-capped self-claimable ones.

const API_ORIGIN =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  "http://localhost:4000";

export type AwardScholarCreditsOptions = {
  source: string;
  venture?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
  referenceId?: string;
  referenceType?: string;
};

export type AwardScholarCreditsResult =
  | { awarded: true; alreadyProcessed?: boolean }
  | { awarded: false; error?: string };

export async function awardScholarCredits(
  request: NextRequest,
  options: AwardScholarCreditsOptions
): Promise<AwardScholarCreditsResult> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  if (!cookieHeader) {
    return { awarded: false, error: "no-session-cookie" };
  }

  const csrfCookie = request.cookies.get("saedu_csrf")?.value ?? "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Cookie: cookieHeader,
  };
  if (csrfCookie) {
    headers["x-csrf-token"] = csrfCookie;
  }

  try {
    const response = await fetch(`${API_ORIGIN}/credits/earn`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        venture: options.venture ?? "SCHOOL",
        source: options.source,
        ...(options.description ? { description: options.description } : {}),
        ...(options.metadata ? { metadata: options.metadata } : {}),
        idempotencyKey: options.idempotencyKey,
        ...(options.referenceId ? { referenceId: options.referenceId } : {}),
        ...(options.referenceType ? { referenceType: options.referenceType } : {}),
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return { awarded: false, error: `HTTP ${response.status}` };
    }

    const data = (await response.json()) as { alreadyProcessed?: boolean };
    return { awarded: true, alreadyProcessed: data.alreadyProcessed };
  } catch (error) {
    return { awarded: false, error: error instanceof Error ? error.message : String(error) };
  }
}
