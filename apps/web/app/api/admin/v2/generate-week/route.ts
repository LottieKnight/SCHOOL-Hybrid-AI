import { retiredRouteResponse } from "@/lib/retiredRoute";

export const runtime = "nodejs";

export async function POST() {
  return retiredRouteResponse({
    replacement: "/api/admin/generate-lesson-v1",
    reason: "Lesson v2 storage is retired. Lesson v1 file generation is canonical.",
  });
}
