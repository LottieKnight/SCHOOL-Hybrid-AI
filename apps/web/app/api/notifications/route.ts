import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const result = await queryPlannerDb<{ id: string; title: string; message: string; link: string; type: string; is_read: boolean; created_at: string }>(
      `SELECT * FROM user_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );

    return NextResponse.json({ notifications: result.rows });
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await queryPlannerDb(`UPDATE user_notifications SET is_read = TRUE WHERE user_id = $1`, [
      session.user.id,
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update notifications:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await request.json();
  const { id } = body;

  try {
    if (id) {
      await queryPlannerDb(`UPDATE user_notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`, [id, userId]);
    } else {
      await queryPlannerDb(`UPDATE user_notifications SET is_read = TRUE WHERE user_id = $1`, [userId]);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update notifications:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
