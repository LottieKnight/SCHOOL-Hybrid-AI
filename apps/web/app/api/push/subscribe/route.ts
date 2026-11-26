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

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: "Missing subscription fields" }, { status: 400 });
  }

  try {
    await queryPlannerDb(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, p256dh = $3, auth = $4`,
      [session.user.id, body.endpoint, body.keys.p256dh, body.keys.auth]
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to store subscription" }, { status: 500 });
  }
}
