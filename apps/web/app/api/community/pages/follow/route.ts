import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { getUserAppPreferences, patchUserAppPreferences } from "@/lib/server/userProfileState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizePageCode(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().toUpperCase();
}

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { pageCode?: unknown } | null;
  const pageCode = normalizePageCode(typeof body?.pageCode === "string" ? body.pageCode : "");
  if (!pageCode) {
    return NextResponse.json({ error: "A page code is required." }, { status: 400 });
  }

  const preferences = await getUserAppPreferences(userId).catch(() => ({}));
  const community = asRecord(asRecord(preferences).community);
  const existingFollowedPages = Array.isArray(community.followedPageCodes)
    ? community.followedPageCodes.filter((entry): entry is string => typeof entry === "string")
    : [];
  const followedPageCodes = existingFollowedPages.includes(pageCode)
    ? existingFollowedPages.filter((entry) => entry !== pageCode)
    : [...existingFollowedPages, pageCode];

  await patchUserAppPreferences(userId, {
    community: {
      ...community,
      followedPageCodes,
    },
  });

  return NextResponse.json({
    pageCode,
    following: followedPageCodes.includes(pageCode),
    followedPageCodes,
  });
}

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const preferences = await getUserAppPreferences(userId).catch(() => ({}));
  const community = asRecord(asRecord(preferences).community);
  const followedPageCodes = Array.isArray(community.followedPageCodes)
    ? community.followedPageCodes.filter((entry): entry is string => typeof entry === "string")
    : [];

  return NextResponse.json({ followedPageCodes });
}
