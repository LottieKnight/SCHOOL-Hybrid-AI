import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

function loadEnvFromFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    if (!key || process.env[key]) continue;
    const value = line.slice(idx + 1).trim();
    if (!value) continue;
    process.env[key] = value;
  }
}

function loadEnv() {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, ".env.local"),
    path.join(cwd, ".env"),
    path.join(cwd, "apps", "web", ".env.local"),
    path.join(cwd, "apps", "web", ".env"),
  ];
  for (const filePath of candidates) {
    loadEnvFromFile(filePath);
  }

  if (!process.env.PAST_PAPERS_DATABASE_URL) {
    process.env.PAST_PAPERS_DATABASE_URL = "file:./past-papers.db";
  }
}

async function main() {
  loadEnv();
  const prisma = new PrismaClient();

  try {
    console.log("[debug-past-papers] Using DB URL:", process.env.PAST_PAPERS_DATABASE_URL);

    const [
      totalPapers,
      uiReadyPapers,
      withPaperStorageKey,
      withMemoStorageKey,
      missingPaperStorageKey,
      missingMemoStorageKey,
      missingPaperUrlOriginal,
      missingMemoUrlOriginal,
      byProvince,
      byGrade,
      byYear,
      bySession,
      samples,
    ] = await Promise.all([
      prisma.pastPaper.count(),
      prisma.pastPaper.count({
        where: {
          paperStorageKey: { not: null },
          grade: { not: null },
          year: { not: null },
          subject: { not: "Unknown" },
        },
      }),
      prisma.pastPaper.count({ where: { paperStorageKey: { not: null } } }),
      prisma.pastPaper.count({ where: { memoStorageKey: { not: null } } }),
      prisma.pastPaper.count({ where: { paperStorageKey: null } }),
      prisma.pastPaper.count({ where: { memoStorageKey: null } }),
      prisma.pastPaper.count({ where: { paperUrlOriginal: null } }),
      prisma.pastPaper.count({ where: { memoUrlOriginal: null } }),
      prisma.pastPaper.groupBy({
        by: ["province"],
        _count: { _all: true },
        orderBy: { province: "asc" },
      }),
      prisma.pastPaper.groupBy({
        by: ["grade"],
        _count: { _all: true },
        orderBy: { grade: "asc" },
      }),
      prisma.pastPaper.groupBy({
        by: ["year"],
        _count: { _all: true },
        orderBy: { year: "desc" },
      }),
      prisma.pastPaper.groupBy({
        by: ["session"],
        _count: { _all: true },
        orderBy: { session: "asc" },
      }),
      prisma.pastPaper.findMany({
        where: {
          paperStorageKey: { not: null },
          grade: { not: null },
          year: { not: null },
          subject: { not: "Unknown" },
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 5,
        select: {
          id: true,
          title: true,
          province: true,
          grade: true,
          subject: true,
          year: true,
          session: true,
          paperNumber: true,
          language: true,
          sourcePageUrl: true,
          paperUrlOriginal: true,
          memoUrlOriginal: true,
          paperStorageKey: true,
          memoStorageKey: true,
        },
      }),
    ]);

    console.log("\n[debug-past-papers] Counts");
    console.log(
      JSON.stringify(
        {
          totalPapers,
          uiReadyPapers,
          withPaperStorageKey,
          withMemoStorageKey,
          missingPaperStorageKey,
          missingMemoStorageKey,
          missingPaperUrlOriginal,
          missingMemoUrlOriginal,
        },
        null,
        2
      )
    );

    console.log("\n[debug-past-papers] Counts by province");
    console.log(JSON.stringify(byProvince, null, 2));

    console.log("\n[debug-past-papers] Counts by grade");
    console.log(JSON.stringify(byGrade, null, 2));

    console.log("\n[debug-past-papers] Counts by year");
    console.log(JSON.stringify(byYear, null, 2));

    console.log("\n[debug-past-papers] Counts by session");
    console.log(JSON.stringify(bySession, null, 2));

    console.log("\n[debug-past-papers] Sample UI-ready rows");
    console.log(JSON.stringify(samples, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[debug-past-papers] Failed:", error);
  process.exit(1);
});
