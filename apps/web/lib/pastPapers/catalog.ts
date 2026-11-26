import type { PastPaper, PastPaperSource } from "@prisma/client";
import { db, type Where } from "@/lib/pastPapers/db";
import { buildPastPaperWhere } from "@/lib/pastPapers/query";
import { memoryCached } from "@/lib/pastPapers/memoryCache";

const CATALOG_REVALIDATE_SECONDS = 60 * 30;

// The OpenNext adapter's incremental cache is `dummy`, so `unstable_cache`
// does not persist and each request re-queries D1. This local shim keeps the
// catalogue in an isolate-local TTL cache so repeated page views don't re-scan
// the whole PastPaper table.
function unstable_cache<T>(
  loader: () => Promise<T>,
  keys: string[],
  options?: { revalidate?: number; tags?: string[] }
) {
  const ttlMs = (options?.revalidate ?? CATALOG_REVALIDATE_SECONDS) * 1000;
  const cacheKey = `pp:catalog:${keys.join("|")}`;
  return () => memoryCached(cacheKey, ttlMs, loader);
}

export async function getPastPaperProvinces(): Promise<{ province: string }[]> {
  return unstable_cache(
    async () =>
      (await db.findMany("PastPaper", {
        where: buildPastPaperWhere(false),
        distinct: ["province"],
        select: ["province"],
        orderBy: { province: "asc" },
      })) as { province: string }[],
    ["past-papers:provinces"],
    { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["past-papers-catalog"] }
  )();
}

export async function getPastPaperGrades(province: string): Promise<{ grade: number }[]> {
  return unstable_cache(
    async () =>
      (await db.findMany("PastPaper", {
        where: { ...buildPastPaperWhere(false), province },
        distinct: ["grade"],
        select: ["grade"],
        orderBy: { grade: "asc" },
      })) as { grade: number }[],
    [`past-papers:grades:${province}`],
    { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["past-papers-catalog"] }
  )();
}

export async function getPastPaperSubjects(
  province: string,
  grade: number
): Promise<{ subject: string }[]> {
  return unstable_cache(
    async () =>
      (await db.findMany("PastPaper", {
        where: { ...buildPastPaperWhere(false), province, grade },
        distinct: ["subject"],
        select: ["subject"],
        orderBy: { subject: "asc" },
      })) as { subject: string }[],
    [`past-papers:subjects:${province}:${grade}`],
    { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["past-papers-catalog"] }
  )();
}

export async function getPastPaperYears(
  province: string,
  grade: number,
  subject: string
): Promise<{ year: number }[]> {
  return unstable_cache(
    async () =>
      (await db.findMany("PastPaper", {
        where: { ...buildPastPaperWhere(false), province, grade, subject },
        distinct: ["year"],
        select: ["year"],
        orderBy: { year: "desc" },
      })) as { year: number }[],
    [`past-papers:years:${province}:${grade}:${subject}`],
    { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["past-papers-catalog"] }
  )();
}

export async function getPastPaperSessions(
  province: string,
  grade: number,
  subject: string,
  year: number
): Promise<{ session: string }[]> {
  return unstable_cache(
    async () =>
      (await db.findMany("PastPaper", {
        where: { ...buildPastPaperWhere(false), province, grade, subject, year },
        distinct: ["session"],
        select: ["session"],
        orderBy: { session: "asc" },
      })) as { session: string }[],
    [`past-papers:sessions:${province}:${grade}:${subject}:${year}`],
    { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["past-papers-catalog"] }
  )();
}

export async function getPastPapers(
  province: string,
  grade: number,
  subject: string,
  year: number,
  session: string
): Promise<PastPaper[]> {
  return unstable_cache(
    async () =>
      (await db.findMany("PastPaper", {
        where: {
          ...buildPastPaperWhere(false),
          province,
          grade,
          subject,
          year,
          session,
        },
        orderBy: [{ paperNumber: "asc" }, { language: "asc" }],
      })) as PastPaper[],
    [`past-papers:list:${province}:${grade}:${subject}:${year}:${session}`],
    { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["past-papers-catalog"] }
  )();
}

export async function getPastPaperWithSourceById(
  id: string
): Promise<(PastPaper & { source: PastPaperSource }) | null> {
  return unstable_cache(
    async () =>
      (await db.findFirst("PastPaper", {
        where: { id },
        include: [
          { as: "source", table: "PastPaperSource", localKey: "sourceId", foreignKey: "id", kind: "one" },
        ],
      })) as (PastPaper & { source: PastPaperSource }) | null,
    [`past-papers:detail:${id}`],
    { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["past-papers-catalog"] }
  )();
}

export async function getPastPaperById(id: string): Promise<PastPaper | null> {
  return unstable_cache(
    async () =>
      (await db.findFirst("PastPaper", {
        where: { id },
      })) as PastPaper | null,
    [`past-papers:item:${id}`],
    { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["past-papers-catalog"] }
  )();
}

export type PastPaperSearchFilters = {
  grade?: number;
  subject?: string;
  year?: number;
  session?: string;
  language?: string;
  hasMemo?: boolean;
  q?: string;
  institutionType?: string;
  limit?: number;
  offset?: number;
};

export type PastPaperListItem = {
  id: string;
  title: string;
  subject: string;
  grade: number | null;
  year: number | null;
  session: string;
  paperNumber: string;
  language: string;
  hasMemo: boolean;
  institutionType: string | null;
  moduleCode: string | null;
};

export async function searchPastPapers(
  filters: PastPaperSearchFilters
): Promise<{ items: PastPaperListItem[]; total: number }> {
  const limit = Math.min(filters.limit ?? 24, 100);
  const offset = filters.offset ?? 0;

  const where: Record<string, unknown> = {
    paperStorageKey: { not: null },
  };

  if (filters.grade !== undefined) where.grade = filters.grade;
  if (filters.year !== undefined) where.year = filters.year;
  if (filters.session) where.session = filters.session;
  if (filters.language) where.language = filters.language;
  if (filters.institutionType) where.institutionType = filters.institutionType;
  if (filters.hasMemo) where.memoStorageKey = { not: null };

  if (filters.subject) where.subject = filters.subject;
  else if (filters.q) where.subject = { contains: filters.q };

  const cacheKey = JSON.stringify({ ...filters, limit, offset });

  return unstable_cache(
    async () => {
      const [rows, total] = await Promise.all([
        db.findMany("PastPaper", {
          where: where as Where,
          orderBy: [{ year: "desc" }, { subject: "asc" }, { paperNumber: "asc" }],
          take: limit,
          skip: offset,
          select: [
            "id",
            "title",
            "subject",
            "grade",
            "year",
            "session",
            "paperNumber",
            "language",
            "memoStorageKey",
            "institutionType",
            "moduleCode",
          ],
        }),
        db.count("PastPaper", where as Where),
      ]);

      return {
        items: (rows as Array<{
          id: string;
          title: string;
          subject: string;
          grade: number | null;
          year: number | null;
          session: string;
          paperNumber: string;
          language: string;
          memoStorageKey: string | null;
          institutionType: string | null;
          moduleCode: string | null;
        }>).map((r) => ({ ...r, hasMemo: r.memoStorageKey !== null })),
        total,
      };
    },
    [`past-papers:search:${cacheKey}`],
    { revalidate: 60 * 5, tags: ["past-papers-catalog"] }
  )();
}

export async function getPastPaperAttemptStats(
  userId: string,
  pastPaperId: string
): Promise<{ count: number; bestScore: number | null }> {
  const attempts = (await db.findMany("PastPaperAttempt", {
    where: { userId, pastPaperId, status: "submitted" },
    select: ["totalScore", "totalMax"],
  })) as Array<{ totalScore: number | null; totalMax: number | null }>;

  if (!attempts.length) return { count: 0, bestScore: null };

  const scores = attempts
    .filter((a) => a.totalScore !== null && a.totalMax !== null && a.totalMax > 0)
    .map((a) => (a.totalScore! / a.totalMax!) * 100);

  return {
    count: attempts.length,
    bestScore: scores.length ? Math.max(...scores) : null,
  };
}