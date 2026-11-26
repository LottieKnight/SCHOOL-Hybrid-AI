import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = session?.user?.id;

  try {
    const result = await queryPlannerDb<{ id: string; title: string; description: string; status: string; vote_count: string; user_voted: boolean }>(
      `
        SELECT 
          f.id::text, f.title, f.description, f.status,
          COUNT(v.user_id)::text AS vote_count,
          EXISTS(SELECT 1 FROM user_feature_votes WHERE feature_id = f.id AND user_id = $1) AS user_voted
        FROM feature_requests f
        LEFT JOIN user_feature_votes v ON v.feature_id = f.id
        GROUP BY f.id
        ORDER BY vote_count DESC, f.created_at DESC
      `,
      [userId ?? null]
    );

    const features = result.rows.map(r => ({
      ...r,
      vote_count: parseInt(r.vote_count, 10),
    }));

    return NextResponse.json({ features });
  } catch (error) {
    console.error("Failed to fetch features:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
