import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ActivityItem = {
  id: string;
  kind: "post" | "comment";
  content: string;
  moduleCode: string | null;
  createdAt: string;
};

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    const [postsResult, commentsResult] = await Promise.all([
      queryPlannerDb<{
        id: string;
        content: string;
        module_code: string | null;
        created_at: string;
      }>(
        `SELECT id::text, content, module_code, created_at::text
         FROM posts
         WHERE user_id = $1 AND is_hidden = FALSE
         ORDER BY created_at DESC
         LIMIT 5`,
        [userId]
      ),
      queryPlannerDb<{
        id: string;
        post_id: string;
        content: string;
        created_at: string;
        module_code: string | null;
      }>(
        `SELECT c.id::text, c.post_id::text, c.content, c.created_at::text, p.module_code
         FROM comments c
         LEFT JOIN posts p ON p.id = c.post_id
         WHERE c.user_id = $1 AND c.is_hidden = FALSE
         ORDER BY c.created_at DESC
         LIMIT 5`,
        [userId]
      ),
    ]);

    const activity: ActivityItem[] = [
      ...postsResult.rows.map((r) => ({
        id: `post-${r.id}`,
        kind: "post" as const,
        content: r.content,
        moduleCode: r.module_code,
        createdAt: r.created_at,
      })),
      ...commentsResult.rows.map((r) => ({
        id: `comment-${r.id}`,
        kind: "comment" as const,
        content: r.content,
        moduleCode: r.module_code,
        createdAt: r.created_at,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Failed to load profile activity:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
