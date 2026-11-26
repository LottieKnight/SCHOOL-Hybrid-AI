import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  try {
    const result = await queryPlannerDb<{ content: string; entry_date: string }>(
      `SELECT content, entry_date::text FROM gratitude_journal WHERE user_id = $1 ORDER BY entry_date DESC LIMIT 7`,
      [userId]
    );
    return NextResponse.json({ journal: result.rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const body = await request.json();
  const { content } = body;

  if (!content) return NextResponse.json({ error: "Missing content" }, { status: 400 });

  try {
    await queryPlannerDb(
      `INSERT INTO gratitude_journal (user_id, content) VALUES ($1, $2)
       ON CONFLICT (user_id, entry_date) DO UPDATE SET content = EXCLUDED.content`,
      [userId, content]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
