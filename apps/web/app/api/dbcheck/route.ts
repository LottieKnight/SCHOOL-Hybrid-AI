import { NextResponse } from "next/server";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export async function GET() {
  try {
    const one = await queryPlannerDb<{ ok: number }>("SELECT 1 as ok");
    const lib = await queryPlannerDb<{ title: string }>(
      "SELECT title FROM library_resources LIMIT 1"
    );
    return NextResponse.json({ db: true, one: one.rows[0]?.ok, sample: lib.rows[0]?.title ?? null });
  } catch (e: any) {
    return NextResponse.json({ db: false, error: String(e?.message || e) }, { status: 500 });
  }
}