import { retiredRouteResponse } from "@/lib/retiredRoute";

export const runtime = "nodejs";

export async function POST() {
  return retiredRouteResponse({
    replacement: "/api/admin/generate-lesson-v1",
    reason: "Legacy RAG generation endpoint is retired. Lesson v1 generation is canonical.",
  });
}
