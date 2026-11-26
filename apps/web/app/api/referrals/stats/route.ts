import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyToken } from "@/lib/server/cookieAuth";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REFERRAL_BONUS_CREDITS = 50;

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await queryPlannerDb<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM referrals WHERE referrer_id = $1 AND bonus_credited_at IS NOT NULL",
      [payload.sub]
    );
    const count = parseInt(result.rows[0]?.count ?? "0", 10);

    return NextResponse.json({
      count,
      creditsEarned: count * REFERRAL_BONUS_CREDITS,
      bonusPerReferral: REFERRAL_BONUS_CREDITS,
    });
  } catch (error) {
    console.error("[referrals/stats]", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
