import { NextRequest, NextResponse } from "next/server";
import { COMMUNITY_REACTION_TYPES, type CommunityReactionType } from "@/lib/communityShared";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { toggleCommunityReaction } from "@/lib/server/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  postId?: string;
  reactionType?: string;
};

function isReactionType(value: string): value is CommunityReactionType {
  return COMMUNITY_REACTION_TYPES.includes(value as CommunityReactionType);
}

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const postId = typeof body.postId === "string" ? body.postId.trim() : "";
  const reactionType = typeof body.reactionType === "string" ? body.reactionType.trim() : "";

  if (!postId || !reactionType || !isReactionType(reactionType)) {
    return NextResponse.json({ error: "A valid post and reaction are required." }, { status: 400 });
  }

  const result = await toggleCommunityReaction({
    userId,
    postId,
    reactionType,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true, active: result.active });
}
