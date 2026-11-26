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
  const { score, comment } = body;

  if (typeof score !== "number" || score < 0 || score > 10) {
    return NextResponse.json({ error: "Invalid score" }, { status: 400 });
  }

  try {
    await queryPlannerDb(
      `INSERT INTO user_nps_surveys (user_id, score, comment) VALUES ($1, $2, $3)`,
      [userId, score, comment ?? null]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save NPS:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
