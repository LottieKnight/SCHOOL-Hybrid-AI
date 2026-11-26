import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  computePastPapersCoverageSnapshot,
  evaluatePastPapersCoverageSlo,
  readPastPapersCoverageSloConfig,
} from "../apps/web/lib/pastPapers/coverage";

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

function hasFlag(name: string) {
  return process.argv.includes(name);
}

async function main() {
  loadEnv();
  const requireSlo = hasFlag("--require-slo");
  const prisma = new PrismaClient();

  try {
    const snapshot = await computePastPapersCoverageSnapshot(prisma);
    const sloConfig = readPastPapersCoverageSloConfig(process.env);
    const slo = evaluatePastPapersCoverageSlo(snapshot, sloConfig);

    console.log(
      JSON.stringify(
        {
          snapshot,
          slo,
        },
        null,
        2
      )
    );

    if (requireSlo && !slo.ok) {
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[past-papers-coverage] failed:", error);
  process.exit(1);
});
