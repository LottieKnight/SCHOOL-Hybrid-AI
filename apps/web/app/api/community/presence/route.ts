import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const moduleCode = searchParams.get("moduleCode");

  if (!moduleCode) {
    return NextResponse.json({ error: "Missing moduleCode" }, { status: 400 });
  }

  try {
    const result = await queryPlannerDb<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM module_active_presence WHERE module_code = $1 AND last_active_at >= NOW() - INTERVAL '5 minutes'`,
      [moduleCode]
    );

    return NextResponse.json({ count: parseInt(result.rows[0]?.count ?? "0", 10) });
  } catch (error) {
    console.error("Failed to fetch presence:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await request.json();
  const { moduleCode } = body;

  if (!moduleCode) {
    return NextResponse.json({ error: "Missing moduleCode" }, { status: 400 });
  }

  try {
    await queryPlannerDb(
      `
        INSERT INTO module_active_presence (module_code, user_id, last_active_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (module_code, user_id) DO UPDATE SET last_active_at = NOW()
      `,
      [moduleCode, userId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to record presence:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
