import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await request.json();
  const { featureId } = body;

  if (!featureId) {
    return NextResponse.json({ error: "Missing featureId" }, { status: 400 });
  }

  try {
    const existing = await queryPlannerDb(
      `SELECT 1 FROM user_feature_votes WHERE user_id = $1 AND feature_id = $2`,
      [userId, featureId]
    );

    if ((existing.rowCount ?? 0) > 0) {
      await queryPlannerDb(
        `DELETE FROM user_feature_votes WHERE user_id = $1 AND feature_id = $2`,
        [userId, featureId]
      );
      return NextResponse.json({ success: true, voted: false });
    } else {
      await queryPlannerDb(
        `INSERT INTO user_feature_votes (user_id, feature_id) VALUES ($1, $2)`,
        [userId, featureId]
      );
      return NextResponse.json({ success: true, voted: true });
    }
  } catch (error) {
    console.error("Failed to toggle feature vote:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
