import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type BackfillOptions = {
  dryRun: boolean;
  sourceName: string | null;
  province: string | null;
  limit: number;
};

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
}

function parseNumber(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  return rounded > 0 ? rounded : fallback;
}

function parseArg(name: string) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function parseOptions(): BackfillOptions {
  return {
    dryRun: process.argv.includes("--dry-run"),
    sourceName: parseArg("--source"),
    province: parseArg("--province"),
    limit: parseNumber(parseArg("--limit"), 5000),
  };
}

function extractYears(source: string) {
  return Array.from(source.matchAll(/(?<!\d)(20\d{2})(?!\d)/g))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value >= 2000 && value <= 2099);
}

function inferYear(input: {
  title: string;
  sourcePageUrl: string | null;
  paperUrlOriginal: string | null;
  memoUrlOriginal: string | null;
  paperStorageKey: string | null;
  memoStorageKey: string | null;
}) {
  const blob = decodeURIComponent(
    [
      input.title,
      input.sourcePageUrl || "",
      input.paperUrlOriginal || "",
      input.memoUrlOriginal || "",
      input.paperStorageKey || "",
      input.memoStorageKey || "",
    ].join(" ")
  );
  const years = extractYears(blob);
  if (!years.length) return null;
  return Math.max(...years);
}

async function main() {
  loadEnv();
  const options = parseOptions();
  const prisma = new PrismaClient();

  try {
    let sourceId: string | null = null;
    if (options.sourceName) {
      const source = await prisma.pastPaperSource.findUnique({
        where: { name: options.sourceName.toUpperCase() },
        select: { id: true },
      });
      if (!source) {
        throw new Error(`Source "${options.sourceName}" was not found.`);
      }
      sourceId = source.id;
    }

    const candidates = await prisma.pastPaper.findMany({
      where: {
        year: null,
        ...(sourceId ? { sourceId } : {}),
        ...(options.province ? { province: options.province } : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      take: options.limit,
      select: {
        id: true,
        sourceId: true,
        province: true,
        grade: true,
        subject: true,
        year: true,
        session: true,
        paperNumber: true,
        language: true,
        title: true,
        sourcePageUrl: true,
        paperUrlOriginal: true,
        memoUrlOriginal: true,
        paperStorageKey: true,
        memoStorageKey: true,
        sha256Paper: true,
        sha256Memo: true,
      },
    });

    let inferredCount = 0;
    let updatedCount = 0;
    let mergedCount = 0;
    let noYearCount = 0;
    let conflictCount = 0;
    const samples: Array<Record<string, unknown>> = [];

    for (const row of candidates) {
      const inferredYear = inferYear(row);
      if (inferredYear === null) {
        noYearCount += 1;
        continue;
      }
      inferredCount += 1;

      if (samples.length < 20) {
        samples.push({
          id: row.id,
          province: row.province,
          grade: row.grade,
          subject: row.subject,
          session: row.session,
          paperNumber: row.paperNumber,
          language: row.language,
          inferredYear,
          sourcePageUrl: row.sourcePageUrl,
        });
      }

      if (options.dryRun) continue;

      try {
        await prisma.pastPaper.update({
          where: { id: row.id },
          data: { year: inferredYear },
        });
        updatedCount += 1;
        continue;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("Unique constraint")) {
          conflictCount += 1;
          continue;
        }
      }

      const target = await prisma.pastPaper.findFirst({
        where: {
          id: { not: row.id },
          sourceId: row.sourceId,
          province: row.province,
          grade: row.grade,
          subject: row.subject,
          year: inferredYear,
          session: row.session,
          paperNumber: row.paperNumber,
          language: row.language,
        },
        orderBy: { updatedAt: "desc" },
      });

      if (!target) {
        conflictCount += 1;
        continue;
      }

      await prisma.pastPaper.update({
        where: { id: target.id },
        data: {
          sourcePageUrl: target.sourcePageUrl || row.sourcePageUrl,
          paperUrlOriginal: target.paperUrlOriginal || row.paperUrlOriginal,
          memoUrlOriginal: target.memoUrlOriginal || row.memoUrlOriginal,
          paperStorageKey: target.paperStorageKey || row.paperStorageKey,
          memoStorageKey: target.memoStorageKey || row.memoStorageKey,
          sha256Paper: target.sha256Paper || row.sha256Paper,
          sha256Memo: target.sha256Memo || row.sha256Memo,
        },
      });
      await prisma.pastPaper.delete({ where: { id: row.id } });
      mergedCount += 1;
    }

    console.log(
      JSON.stringify(
        {
          dryRun: options.dryRun,
          sourceName: options.sourceName,
          province: options.province,
          limit: options.limit,
          scanned: candidates.length,
          inferredCount,
          noYearCount,
          updatedCount,
          mergedCount,
          conflictCount,
          samples,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[backfill-past-papers-year] failed:", error);
  process.exit(1);
});
