import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { toggleCommentLike } from "@/lib/server/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { commentId?: string };
  if (!body.commentId) return NextResponse.json({ error: "Missing commentId" }, { status: 400 });

  const result = await toggleCommentLike({ commentId: body.commentId, userId });
  return NextResponse.json(result);
}
