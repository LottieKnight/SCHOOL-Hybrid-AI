import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { getUserAppPreferences } from "@/lib/server/userProfileState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (!userId) {
    return NextResponse.json({ current: 0, longest: 0 });
  }

  try {
    const prefs = await getUserAppPreferences(userId);
    const streakData = (prefs.communityStreak ?? {}) as Record<string, unknown>;
    return NextResponse.json({
      current: typeof streakData.current === "number" ? streakData.current : 0,
      longest: typeof streakData.longest === "number" ? streakData.longest : 0,
    });
  } catch {
    return NextResponse.json({ current: 0, longest: 0 });
  }
}
