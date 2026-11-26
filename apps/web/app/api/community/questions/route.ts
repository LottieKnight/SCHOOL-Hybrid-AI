import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { getInstitutionContextForUser } from "@/lib/server/institutions";
import { getUserAppPreferences, readAcademicState } from "@/lib/server/userProfileState";
import { listCommunityQuestions } from "@/lib/server/community";
import type { CommunityQuestionFilter } from "@/lib/communityShared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_FILTERS = new Set<CommunityQuestionFilter>(["all", "unanswered", "my-modules", "recent", "for-you"]);

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? null;
  const since = url.searchParams.get("since") ?? null;
  const rawFilter = url.searchParams.get("filter") ?? "all";
  const filter: CommunityQuestionFilter = ALLOWED_FILTERS.has(rawFilter as CommunityQuestionFilter)
    ? (rawFilter as CommunityQuestionFilter)
    : "all";

  const institutionId = userId
    ? await getInstitutionContextForUser(userId).then((ctx) => ctx?.id ?? null).catch(() => null)
    : null;

  const academicState = userId
    ? await getUserAppPreferences(userId).then((prefs) => readAcademicState(prefs)).catch(() => readAcademicState({}))
    : readAcademicState({});

  const posts = await listCommunityQuestions({
    userId,
    institutionId,
    academicState,
    filter,
    cursor,
    since,
    limit: 20,
  });

  return NextResponse.json({ posts });
}
