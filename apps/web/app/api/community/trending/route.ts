import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { getInstitutionContextForUser } from "@/lib/server/institutions";
import { getTrendingPosts } from "@/lib/server/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  const institutionId = userId
    ? await getInstitutionContextForUser(userId).then((ctx) => ctx?.id ?? null).catch(() => null)
    : null;

  const posts = await getTrendingPosts(institutionId);
  return NextResponse.json({ posts });
}
