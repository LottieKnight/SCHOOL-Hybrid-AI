// DEPRECATED: Moved to deprecated/ branch.
// Safe to delete after 2026-06-01.
import { retiredRouteResponse } from "@/lib/retiredRoute";

export const runtime = "nodejs";

export async function POST() {
  return retiredRouteResponse({
    replacement: "/api/admin/generate-lesson-v1",
    reason: "Lesson v2 storage is retired. Lesson v1 file generation is canonical.",
  });
}
