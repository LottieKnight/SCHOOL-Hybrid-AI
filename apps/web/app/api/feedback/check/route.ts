import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ show: false });
  }

  const userId = session.user.id;

  try {
    const result = await queryPlannerDb<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM user_nps_surveys WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
      [userId]
    );

    const alreadySubmitted = parseInt(result.rows[0]?.count ?? "0", 10) > 0;
    return NextResponse.json({ show: !alreadySubmitted });
  } catch (error) {
    console.error("Failed to check NPS status:", error);
    return NextResponse.json({ show: false });
  }
}
