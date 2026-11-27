import type { PastPaper, PastPaperSource } from "@prisma/client";
import { db, ensurePastPaperIndexes } from "@/lib/pastPapers/db";
import {
  buildCatalogSearch,
  formatPaperTitle,
  isNonPaperRecord,
  languageLabel,
  memoStatus,
  normalizeSubjectName,
  sessionLabel,
  type CatalogSearchInput,
} from "@/lib/pastPapers/indexing";
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
      (
        (await db.findMany("PastPaper", {
          where: { ...buildPastPaperWhere(false), province, grade },
          distinct: ["subject"],
          select: ["subject"],
          orderBy: { subject: "asc" },
        })) as { subject: string }[]
      ).filter((row) => !isNonPaperRecord({ subject: row.subject, title: row.subject })),
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
      (
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
        })) as PastPaper[]
      ).filter((row) => !isNonPaperRecord({ subject: row.subject, title: row.title })),
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

export type PastPaperSearchFilters = CatalogSearchInput;

export type PastPaperListItem = {
  id: string;
  title: string;
  rawTitle: string;
  subject: string;
  grade: number | null;
  year: number | null;
  session: string;
  sessionCode: string;
  paperNumber: string;
  language: string;
  languageCode: string;
  hasMemo: boolean;
  memoStatus: "available" | "missing" | "unlinked";
  institutionType: string | null;
  moduleCode: string | null;
  province: string | null;
};

type CatalogRow = {
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
  province: string | null;
};

function toListItem(row: CatalogRow): PastPaperListItem {
  const status = memoStatus(row.memoStorageKey, row.year);
  const subject = normalizeSubjectName(row.subject);
  return {
    id: row.id,
    rawTitle: row.title,
    title: formatPaperTitle(row),
    subject,
    grade: row.grade,
    year: row.year,
    session: sessionLabel(row.session),
    sessionCode: row.session,
    paperNumber: row.paperNumber,
    language: languageLabel(row.language),
    languageCode: row.language,
    hasMemo: status === "available",
    memoStatus: status,
    institutionType: row.institutionType,
    moduleCode: row.moduleCode,
    province: row.province,
  };
}

export async function searchPastPapers(
  filters: PastPaperSearchFilters
): Promise<{ items: PastPaperListItem[]; total: number }> {
  const plan = buildCatalogSearch(filters);

  return unstable_cache(
    async () => {
      await ensurePastPaperIndexes();
      const [rows, countRows] = await Promise.all([
        db.raw(plan.listSql, plan.listParams),
        db.raw(plan.countSql, plan.countParams),
      ]);
      return {
        items: (rows as CatalogRow[]).map(toListItem),
        total: Number((countRows[0] as { n?: number } | undefined)?.n ?? 0),
      };
    },
    [`past-papers:search:v2:${plan.cacheKey}`],
    { revalidate: 60 * 5, tags: ["past-papers-catalog"] }
  )();
}

export async function getCatalogFilterOptions(): Promise<{
  grades: number[];
  subjects: string[];
  years: number[];
}> {
  return unstable_cache(
    async () => {
      await ensurePastPaperIndexes();
      const plan = buildCatalogSearch({ allGrades: true, limit: 1, offset: 0 });
      const [grades, subjects, years] = await Promise.all([
        db.raw(
          `SELECT DISTINCT grade AS grade FROM PastPaper WHERE ${plan.whereSql} AND grade IS NOT NULL ORDER BY grade ASC`,
          plan.whereParams
        ),
        db.raw(
          `SELECT DISTINCT subject AS subject FROM PastPaper WHERE ${plan.whereSql} ORDER BY subject ASC`,
          plan.whereParams
        ),
        db.raw(
          `SELECT DISTINCT year AS year FROM PastPaper WHERE ${plan.whereSql} AND year IS NOT NULL ORDER BY year DESC`,
          plan.whereParams
        ),
      ]);
      const subjectNames = new Set<string>();
      for (const row of subjects as Array<{ subject: string }>) {
        if (isNonPaperRecord({ subject: row.subject, title: row.subject })) continue;
        subjectNames.add(normalizeSubjectName(row.subject));
      }
      return {
        grades: (grades as Array<{ grade: number }>).map((row) => row.grade),
        subjects: [...subjectNames].sort((a, b) => a.localeCompare(b, "en")),
        years: (years as Array<{ year: number }>).map((row) => row.year),
      };
    },
    ["past-papers:filters:v2"],
    { revalidate: 60 * 30, tags: ["past-papers-catalog"] }
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