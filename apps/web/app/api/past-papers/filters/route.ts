import { NextResponse } from "next/server";
import { db } from "@/lib/pastPapers/db";
import { buildPastPaperWhere } from "@/lib/pastPapers/query";
import { memoryCached } from "@/lib/pastPapers/memoryCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const filters = await memoryCached("past-papers:filters", 30 * 60 * 1000, async () => {
    const [grades, subjects, years] = await Promise.all([
      (await db.findMany("PastPaper", {
        where: buildPastPaperWhere(false),
        distinct: ["grade"],
        select: ["grade"],
        orderBy: { grade: "asc" },
      })) as Array<{ grade: number | null }>,
      (await db.findMany("PastPaper", {
        where: buildPastPaperWhere(false),
        distinct: ["subject"],
        select: ["subject"],
        orderBy: { subject: "asc" },
      })) as Array<{ subject: string | null }>,
      (await db.findMany("PastPaper", {
        where: buildPastPaperWhere(false),
        distinct: ["year"],
        select: ["year"],
        orderBy: { year: "desc" },
      })) as Array<{ year: number | null }>,
    ]);

    return {
      grades: grades
        .map((row) => row.grade)
        .filter((value): value is number => typeof value === "number"),
      subjects: subjects
        .map((row) => row.subject)
        .filter((value): value is string => typeof value === "string"),
      years: years
        .map((row) => row.year)
        .filter((value): value is number => typeof value === "number"),
    };
  });

  return NextResponse.json(filters);
}
