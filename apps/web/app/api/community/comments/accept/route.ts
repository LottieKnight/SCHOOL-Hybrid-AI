import { NextRequest, NextResponse } from "next/server";
import { acceptCommunityAnswer } from "@/lib/server/community";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AcceptBody = {
  postId?: unknown;
  commentId?: unknown;
};

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: AcceptBody;
  try {
    body = (await request.json()) as AcceptBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const postId = typeof body.postId === "string" ? body.postId.trim() : "";
  const commentId = typeof body.commentId === "string" ? body.commentId.trim() : "";
  if (!postId || !commentId) {
    return NextResponse.json({ error: "postId and commentId are required." }, { status: 400 });
  }

  const result = await acceptCommunityAnswer({
    userId,
    postId,
    commentId,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    creditsAwarded: result.creditsAwarded,
    alreadyAwarded: result.alreadyAwarded,
  });
}
