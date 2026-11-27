import { NextRequest, NextResponse } from "next/server";
import { searchPastPapers } from "@/lib/pastPapers/catalog";
import { parseGradeQuery } from "@/lib/pastPapers/indexing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, toInt(searchParams.get("page")) ?? 1);
  const pageSize = Math.min(Math.max(toInt(searchParams.get("limit")) ?? 20, 1), 50);
  const offset = (page - 1) * pageSize;
  const gradeQuery = parseGradeQuery(searchParams.get("grade") || undefined);

  const { items, total } = await searchPastPapers({
    grade: gradeQuery.grade,
    allGrades: gradeQuery.allGrades,
    subject: searchParams.get("subject") || undefined,
    year: toInt(searchParams.get("year")),
    session: searchParams.get("session") || undefined,
    language: searchParams.get("language") || undefined,
    hasMemo: searchParams.get("hasMemo") === "1" ? true : undefined,
    q: searchParams.get("q") || undefined,
    limit: pageSize,
    offset,
  });

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
  });
}
