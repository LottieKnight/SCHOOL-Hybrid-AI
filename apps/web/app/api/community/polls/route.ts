import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { castPollVote, getPollResults } from "@/lib/server/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { postId?: string; optionIndex?: number };
  if (!body.postId || typeof body.optionIndex !== "number") {
    return NextResponse.json({ error: "postId and optionIndex are required." }, { status: 400 });
  }

  const result = await castPollVote({ postId: body.postId, userId, optionIndex: body.optionIndex });
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });

  const results = await getPollResults(body.postId, userId);
  return NextResponse.json({ ok: true, results });
}

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  const postId = request.nextUrl.searchParams.get("postId");
  if (!postId) return NextResponse.json({ error: "postId required." }, { status: 400 });

  const results = await getPollResults(postId, userId);
  return NextResponse.json({ results });
}
