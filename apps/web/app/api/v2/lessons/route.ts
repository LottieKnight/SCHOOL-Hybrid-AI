// DEPRECATED: Moved to deprecated/ branch.
// Safe to delete after 2026-06-01.
import { retiredRouteResponse } from "@/lib/retiredRoute";

export const runtime = "nodejs";

export async function GET() {
  return retiredRouteResponse({
    replacement: "/learn/{phase}/{grade}/{subject}/term/{term}/week/{week}",
    reason: "Lesson v2 API is retired. Lesson v1 file reads from /learn are canonical.",
  });
}
