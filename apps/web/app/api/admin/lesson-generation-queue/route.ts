import { NextRequest } from "next/server";
import { proxyAdminLessonGet } from "@/lib/adminLessonProxy";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const limit = request.nextUrl.searchParams.get("limit");
  const suffix = limit ? `?limit=${encodeURIComponent(limit)}` : "";
  return proxyAdminLessonGet(request, `/admin/lessons/v1/queue${suffix}`);
}
