import { spawn } from "node:child_process";
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
}

function parseArg(name: string) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function toInt(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function runNpm(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("npm", args, {
      cwd: process.cwd(),
      shell: true,
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`npm ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

function identityKey(input: {
  sourceId: string;
  province: string;
  grade: number | null;
  subject: string;
  year: number | null;
  session: string;
  paperNumber: string;
  language: string;
}) {
  return [
    input.sourceId,
    input.province,
    input.grade === null ? "null" : String(input.grade),
    input.subject,
    input.year === null ? "null" : String(input.year),
    input.session,
    input.paperNumber,
    input.language,
  ].join("|");
}

type CountsSnapshot = {
  totalRows: number;
  uiReadyRows: number;
  paperOnlyCount: number;
  memoOnlyCount: number;
  bothCount: number;
};

async function getCounts(prisma: PrismaClient): Promise<CountsSnapshot> {
  const [totalRows, uiReadyRows, paperOnlyCount, memoOnlyCount, bothCount] = await Promise.all([
    prisma.pastPaper.count(),
    prisma.pastPaper.count({
      where: {
        paperStorageKey: { not: null },
        grade: { not: null },
        year: { not: null },
        subject: { not: "Unknown" },
      },
    }),
    prisma.pastPaper.count({
      where: {
        paperStorageKey: { not: null },
        memoStorageKey: null,
      },
    }),
    prisma.pastPaper.count({
      where: {
        paperStorageKey: null,
        memoStorageKey: { not: null },
      },
    }),
    prisma.pastPaper.count({
      where: {
        paperStorageKey: { not: null },
        memoStorageKey: { not: null },
      },
    }),
  ]);

  return {
    totalRows,
    uiReadyRows,
    paperOnlyCount,
    memoOnlyCount,
    bothCount,
  };
}

async function main() {
  loadEnv();
  const maxLinks = toInt(parseArg("--max-links"), 10);
  const province = parseArg("--province");
  const repairOrphans = hasFlag("--repair-orphans");
  const repairLimit = toInt(parseArg("--repair-limit"), 50);

  console.log(
    `[ingest:dbe:smoke] Step 1/4: Dry run parse check (max-links=${maxLinks}, province=${province || "all"})`
  );
  await runNpm([
    "run",
    "ingest:dbe",
    "--",
    "--dry-run",
    "--source=DBE",
    ...(province ? [`--province=${province}`] : []),
    `--max-links=${maxLinks}`,
    "--debug-fetch",
    "--no-fail-on-error",
  ]);

  const prisma = new PrismaClient();
  let beforeCounts: CountsSnapshot;
  try {
    beforeCounts = await getCounts(prisma);
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    `[ingest:dbe:smoke] Step 2/4: Bounded real ingest (max-links=${maxLinks}, province=${province || "all"}, repairOrphans=${repairOrphans}, repairLimit=${repairLimit})`
  );
  const runArgs = ["run", "ingest:dbe", "--", "--source=DBE", `--max-links=${maxLinks}`];
  if (province) {
    runArgs.push(`--province=${province}`);
  }
  if (repairOrphans) {
    runArgs.push("--repair-orphans", `--repair-limit=${repairLimit}`);
  }
  await runNpm(runArgs);

  console.log("[ingest:dbe:smoke] Step 3/4: DB summary");
  const summaryPrisma = new PrismaClient();
  try {
    const [afterCounts, paperOnlyRows, samples] = await Promise.all([
      getCounts(summaryPrisma),
      summaryPrisma.pastPaper.findMany({
        where: {
          paperStorageKey: { not: null },
          memoStorageKey: null,
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 10,
        select: {
          sourceId: true,
          province: true,
          grade: true,
          subject: true,
          year: true,
          session: true,
          paperNumber: true,
          language: true,
          sourcePageUrl: true,
          paperUrlOriginal: true,
        },
      }),
      summaryPrisma.pastPaper.findMany({
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

    console.log(
      JSON.stringify(
        {
          maxLinks,
          province,
          repairOrphans,
          repairLimit,
          before: beforeCounts,
          after: afterCounts,
          delta: {
            paperOnlyCount: afterCounts.paperOnlyCount - beforeCounts.paperOnlyCount,
            memoOnlyCount: afterCounts.memoOnlyCount - beforeCounts.memoOnlyCount,
            bothCount: afterCounts.bothCount - beforeCounts.bothCount,
            uiReadyRows: afterCounts.uiReadyRows - beforeCounts.uiReadyRows,
          },
          topPaperOnlyIdentityKeys: paperOnlyRows.map((row) => ({
            identityKey: identityKey(row),
            sourcePageUrl: row.sourcePageUrl,
            fileUrlOriginal: row.paperUrlOriginal,
          })),
          sampleUiReadyRows: samples,
        },
        null,
        2
      )
    );
  } finally {
    await summaryPrisma.$disconnect();
  }

  console.log("[ingest:dbe:smoke] Step 4/4: complete");
}

main().catch((error) => {
  console.error("[ingest:dbe:smoke] failed:", error);
  process.exit(1);
});
