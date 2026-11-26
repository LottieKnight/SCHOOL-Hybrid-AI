import { NextRequest, NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/csrf";
import { proxyAdminLessonPost } from "@/lib/adminLessonProxy";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { jobId } = await params;
  return proxyAdminLessonPost(request, `/admin/lessons/v1/queue/${jobId}/transition`, payload);
}
