import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { getRelatedQuestions } from "@/lib/server/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  const url = new URL(request.url);
  const moduleCode = url.searchParams.get("moduleCode") ?? "";
  const excludePostId = url.searchParams.get("excludePostId") ?? null;

  if (!moduleCode) return NextResponse.json({ questions: [] });

  const questions = await getRelatedQuestions({ moduleCode, excludePostId, currentUserId: userId });
  return NextResponse.json({ questions });
}
