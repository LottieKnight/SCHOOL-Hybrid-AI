import { NextRequest, NextResponse } from "next/server";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cacheHeaders() {
  return {
    "Cache-Control": "public, max-age=86400",
  };
}

export async function GET(request: NextRequest) {
  const moduleCode = request.nextUrl.searchParams.get("module_code")?.trim().toUpperCase() ?? "";
  const universityId = request.nextUrl.searchParams.get("university_id")?.trim() ?? "";

  if (!moduleCode || !universityId) {
    return NextResponse.json(
      { error: "module_code and university_id are required." },
      { status: 400, headers: cacheHeaders() }
    );
  }

  try {
    const result = await queryPlannerDb<{ semester: number }>(
      `
        SELECT DISTINCT semester
        FROM module_timetables
        WHERE university_id = $1
          AND UPPER(module_code) = $2
          AND semester IN (1, 2)
        ORDER BY semester ASC
      `,
      [universityId, moduleCode]
    );
    const rowCount = result.rows.length;

    if (rowCount === 0) {
      return NextResponse.json({ semester: null, found: false }, { headers: cacheHeaders() });
    }

    if (rowCount > 1) {
      return NextResponse.json({ semester: null, found: true }, { headers: cacheHeaders() });
    }

    const semester = result.rows[0]?.semester;
    return NextResponse.json(
      { semester: semester === 1 || semester === 2 ? semester : null, found: true },
      { headers: cacheHeaders() }
    );
  } catch {
    return NextResponse.json({ semester: null, found: false }, { status: 500, headers: cacheHeaders() });
  }
}
