import { NextRequest, NextResponse } from "next/server";
import { getInstitutionContextForUser } from "@/lib/server/institutions";
import { createCommunityComment } from "@/lib/server/community";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { getUserAppPreferences, readAcademicState } from "@/lib/server/userProfileState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CommentBody = {
  postId?: unknown;
  content?: unknown;
};

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: CommentBody;
  try {
    body = (await request.json()) as CommentBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const postId = typeof body.postId === "string" ? body.postId.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!postId || !content) {
    return NextResponse.json({ error: "postId and content are required." }, { status: 400 });
  }

  if (content.length > 4000) {
    return NextResponse.json({ error: "Comments must be 4000 characters or less." }, { status: 400 });
  }

  const appPreferences = await getUserAppPreferences(userId);
  const academicState = readAcademicState(appPreferences);
  const institutionContext = await getInstitutionContextForUser(userId);

  const result = await createCommunityComment({
    userId,
    faculty: institutionContext?.faculty ?? academicState.faculty ?? null,
    postId,
    content,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ comment: result.comment }, { status: 201 });
}
