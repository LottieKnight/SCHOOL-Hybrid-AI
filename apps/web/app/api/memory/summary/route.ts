import { NextRequest, NextResponse } from "next/server";
import { getMemorySummary } from "@/lib/memory";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const moduleCode = request.nextUrl.searchParams.get("module_code");
  const summary = await getMemorySummary(userId, moduleCode || null);
  return NextResponse.json(summary);
}
