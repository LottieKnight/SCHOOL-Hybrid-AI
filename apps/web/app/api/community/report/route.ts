import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { reportPost } from "@/lib/server/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { postId?: string; reason?: string };
  if (!body.postId || !body.reason) {
    return NextResponse.json({ error: "Missing postId or reason" }, { status: 400 });
  }

  const result = await reportPost({ postId: body.postId, userId, reason: body.reason });
  return NextResponse.json(result);
}
