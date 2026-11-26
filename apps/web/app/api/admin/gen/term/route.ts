import { retiredRouteResponse } from "@/lib/retiredRoute";

export const runtime = "nodejs";

export async function POST() {
  return retiredRouteResponse({
    replacement: "/api/admin/generate-term-v1",
    reason: "DB-first term generation is retired. Lesson v1 file generation is canonical.",
  });
}
