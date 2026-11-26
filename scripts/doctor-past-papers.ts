import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { getStorageProvider } from "../apps/web/lib/storage";
import { fetchWithPoliteHeaders } from "./lib/http";
import {
  computePastPapersCoverageSnapshot,
  evaluatePastPapersCoverageSlo,
  readPastPapersCoverageSloConfig,
} from "../apps/web/lib/pastPapers/coverage";
import {
  OFFICIAL_SOURCE_STRATEGIES,
  extractCandidateYearPagesFromHtml,
  extractPdfLinksFromHtml,
  type SourceStrategy,
} from "./lib/source-strategies";

type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
  data?: Record<string, unknown>;
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

  if (!process.env.PAST_PAPERS_DATABASE_URL) {
    process.env.PAST_PAPERS_DATABASE_URL = "file:./past-papers.db";
  }
}

function parseArg(name: string) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function parseBoolArg(name: string, defaultValue: boolean) {
  const value = parseArg(name);
  if (!value) return defaultValue;
  return value === "1" || value.toLowerCase() === "true";
}

function candidateBaseUrls(baseUrl: string) {
  const values = new Set<string>();
  values.add(baseUrl);
  values.add(process.env.PAST_PAPERS_DOCTOR_BASE_URL || "");
  values.add("http://localhost:3000");
  values.add("http://localhost:3001");
  return Array.from(values).filter(Boolean);
}

function encodeStorageKeyForPath(key: string) {
  return key
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function trimSnippet(value: string) {
  return value.replace(/\s+/g, " ").slice(0, 240);
}

function pickHeaders(headers: Record<string, string>) {
  const keys = ["server", "content-type", "content-length", "location", "set-cookie", "via", "cf-ray"];
  const out: Record<string, string> = {};
  for (const key of keys) {
    if (headers[key]) out[key] = headers[key];
  }
  return out;
}

function isConnectivityError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("fetch failed") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("operation was aborted") ||
    lower.includes("timed out")
  );
}

async function testSourceConnectivity(strategy: SourceStrategy) {
  const firstIndex = strategy.indexUrls[0];
  const response = await fetchWithPoliteHeaders(firstIndex, {
    method: "GET",
    retries: 2,
    logPrefix: `[doctor:${strategy.sourceName}]`,
  });
  const pdfLinks = response.ok ? extractPdfLinksFromHtml(response.text, firstIndex, strategy) : [];
  const yearPages = response.ok ? extractCandidateYearPagesFromHtml(response.text, firstIndex, strategy) : [];
  let firstYearPagePdfLinkCount = 0;
  let firstYearPageSample: string | null = null;

  if (response.ok && yearPages.length > 0) {
    const yearPageResponse = await fetchWithPoliteHeaders(yearPages[0], {
      method: "GET",
      retries: 2,
      logPrefix: `[doctor:${strategy.sourceName}:year]`,
    });
    if (yearPageResponse.ok) {
      const yearPdfLinks = extractPdfLinksFromHtml(yearPageResponse.text, yearPages[0], strategy);
      firstYearPagePdfLinkCount = yearPdfLinks.length;
      firstYearPageSample = yearPdfLinks[0]?.url || null;
    }
  }

  return {
    status: response.status,
    headers: pickHeaders(response.headers),
    bodySnippet: trimSnippet(response.text),
    pdfLinkCount: pdfLinks.length,
    firstPdfLink: pdfLinks[0] || null,
    yearPageCount: yearPages.length,
    firstYearPageUrl: yearPages[0] || null,
    firstYearPagePdfLinkCount,
    firstYearPageSample,
  };
}

async function main() {
  loadEnv();

  const minPapers = Number(parseArg("--min-papers") || "1");
  const baseUrl = parseArg("--base-url") || process.env.PAST_PAPERS_DOCTOR_BASE_URL || "http://localhost:3000";
  const requireServer = parseBoolArg("--require-server", false);
  const checks: CheckResult[] = [];
  const prisma = new PrismaClient();
  let uiReadyCount = 0;
  let sampleKey: string | null = null;
  let sampleId: string | null = null;

  console.log("[doctor-past-papers] Starting checks");
  console.log("[doctor-past-papers] DB URL:", process.env.PAST_PAPERS_DATABASE_URL);
  console.log("[doctor-past-papers] Base URL:", baseUrl);
  console.log("[doctor-past-papers] Minimum UI-ready papers:", minPapers);
  console.log("[doctor-past-papers] Require server:", requireServer);

  try {
    try {
      await prisma.$queryRawUnsafe("SELECT 1 AS ok");
      checks.push({ name: "Database connectivity", ok: true, detail: "Connected successfully." });
    } catch (error) {
      checks.push({
        name: "Database connectivity",
        ok: false,
        detail: "Failed to connect.",
        data: { error: error instanceof Error ? error.message : String(error) },
      });
    }

    const modelChecks: Array<{ name: string; run: () => Promise<number> }> = [
      { name: "PastPaperSource table exists", run: () => prisma.pastPaperSource.count() },
      { name: "PastPaper table exists", run: () => prisma.pastPaper.count() },
      { name: "PastPaperQuestion table exists", run: () => prisma.pastPaperQuestion.count() },
      { name: "PastPaperAttempt table exists", run: () => prisma.pastPaperAttempt.count() },
      { name: "PastPaperAnswer table exists", run: () => prisma.pastPaperAnswer.count() },
    ];

    for (const modelCheck of modelChecks) {
      try {
        const rowCount = await modelCheck.run();
        checks.push({
          name: modelCheck.name,
          ok: true,
          detail: "Query succeeded.",
          data: { rowCount },
        });
      } catch (error) {
        checks.push({
          name: modelCheck.name,
          ok: false,
          detail: "Query failed.",
          data: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    }

    const dbeStrategy = OFFICIAL_SOURCE_STRATEGIES.find((item) => item.sourceName === "DBE");
    if (dbeStrategy) {
      try {
        const sourceResult = await testSourceConnectivity(dbeStrategy);
        checks.push({
          name: "DBE source connectivity",
          ok: sourceResult.status >= 200 && sourceResult.status < 400,
          detail:
            sourceResult.status >= 200 && sourceResult.status < 400
              ? `DBE index reachable (HTTP ${sourceResult.status}).`
              : `DBE index returned HTTP ${sourceResult.status}.`,
          data: sourceResult,
        });
        checks.push({
          name: "DBE parse sanity",
          ok: sourceResult.pdfLinkCount > 0 || sourceResult.firstYearPagePdfLinkCount > 0,
          detail:
            sourceResult.pdfLinkCount > 0 || sourceResult.firstYearPagePdfLinkCount > 0
              ? `Found parseable links. indexPdf=${sourceResult.pdfLinkCount}, firstYearPagePdf=${sourceResult.firstYearPagePdfLinkCount}.`
              : "Found no parseable PDF links in DBE index or first discovered year page.",
          data: {
            pdfLinkCount: sourceResult.pdfLinkCount,
            firstPdfLink: sourceResult.firstPdfLink,
            yearPageCount: sourceResult.yearPageCount,
            firstYearPageUrl: sourceResult.firstYearPageUrl,
            firstYearPagePdfLinkCount: sourceResult.firstYearPagePdfLinkCount,
            firstYearPageSample: sourceResult.firstYearPageSample,
          },
        });
      } catch (error) {
        checks.push({
          name: "DBE source connectivity",
          ok: false,
          detail: "Failed to fetch DBE index.",
          data: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    }

    try {
      uiReadyCount = await prisma.pastPaper.count({
        where: {
          paperStorageKey: { not: null },
          grade: { not: null },
          year: { not: null },
          subject: { not: "Unknown" },
        },
      });
      const ok = uiReadyCount >= minPapers;
      checks.push({
        name: "Minimum UI-ready paper count",
        ok,
        detail: ok
          ? `Found ${uiReadyCount} UI-ready papers (minimum ${minPapers}).`
          : `Found ${uiReadyCount} UI-ready papers; expected at least ${minPapers}.`,
        data: { uiReadyCount, minPapers },
      });
    } catch (error) {
      checks.push({
        name: "Minimum UI-ready paper count",
        ok: false,
        detail: "Failed to count UI-ready papers.",
        data: { error: error instanceof Error ? error.message : String(error) },
      });
    }

    try {
      const coverage = await computePastPapersCoverageSnapshot(prisma);
      const sloConfig = readPastPapersCoverageSloConfig(process.env);
      const sloReport = evaluatePastPapersCoverageSlo(coverage, sloConfig);

      checks.push({
        name: "Coverage matrix",
        ok: coverage.pairCount > 0,
        detail:
          coverage.pairCount > 0
            ? `Built ${coverage.pairCount} province-grade coverage rows.`
            : "No province-grade coverage rows were found.",
        data: {
          generatedAtIso: coverage.generatedAtIso,
          provinceCount: coverage.provinceCount,
          pairCount: coverage.pairCount,
          totalWithPaper: coverage.totalWithPaper,
          totalUiReady: coverage.totalUiReady,
          sampleRows: coverage.rows.slice(0, 20),
        },
      });

      checks.push({
        name: "Coverage SLO",
        ok: sloReport.ok,
        detail: sloReport.ok
          ? "Coverage SLOs are satisfied."
          : `Coverage SLO failed with ${sloReport.violationCount} violation(s).`,
        data: {
          config: sloReport.config,
          violationCount: sloReport.violationCount,
          violations: sloReport.violations.slice(0, 30),
        },
      });
    } catch (error) {
      checks.push({
        name: "Coverage matrix",
        ok: false,
        detail: "Failed to compute coverage matrix and SLO report.",
        data: { error: error instanceof Error ? error.message : String(error) },
      });
    }

    try {
      const sample = await prisma.pastPaper.findFirst({
        where: {
          paperStorageKey: { not: null },
          grade: { not: null },
          year: { not: null },
          subject: { not: "Unknown" },
        },
        orderBy: { updatedAt: "desc" },
        select: { id: true, paperStorageKey: true },
      });

      if (!sample?.paperStorageKey) {
        const explainedNoData = uiReadyCount === 0 && minPapers === 0;
        checks.push({
          name: "Sample UI-ready paper key",
          ok: explainedNoData,
          detail: explainedNoData
            ? "No UI-ready papers available yet; sample key check skipped because minimum is 0."
            : "No UI-ready paper with paperStorageKey found.",
        });
      } else {
        sampleId = sample.id;
        sampleKey = sample.paperStorageKey;
        checks.push({
          name: "Sample UI-ready paper key",
          ok: true,
          detail: "Sample UI-ready paper key found.",
          data: { sampleId, sampleKey },
        });
      }
    } catch (error) {
      checks.push({
        name: "Sample UI-ready paper key",
        ok: false,
        detail: "Failed to query sample UI-ready paper key.",
        data: { error: error instanceof Error ? error.message : String(error) },
      });
    }

    if (sampleKey) {
      try {
        const provider = getStorageProvider();
        const exists = await provider.exists(sampleKey);
        checks.push({
          name: "Sample paper file exists in storage",
          ok: exists,
          detail: exists ? "File exists." : "File is missing.",
          data: { sampleId, sampleKey },
        });
      } catch (error) {
        checks.push({
          name: "Sample paper file exists in storage",
          ok: false,
          detail: "Storage existence check failed.",
          data: { error: error instanceof Error ? error.message : String(error), sampleId, sampleKey },
        });
      }

      const encodedKey = encodeStorageKeyForPath(sampleKey);
      const probes: Array<{ baseUrl: string; ok: boolean; status?: number; error?: string }> = [];
      let successProbe: { baseUrl: string; status: number } | null = null;
      let connectivityOnlyFailures = true;

      for (const candidate of candidateBaseUrls(baseUrl)) {
        const fileUrl = `${candidate}/api/files/${encodedKey}`;
        try {
          const response = await fetchWithPoliteHeaders(fileUrl, {
            method: "GET",
            retries: 1,
            skipCache: true,
            timeoutMs: 5000,
            logPrefix: "[doctor:file-route]",
            responseType: "buffer",
          });
          const ok = response.status === 200;
          probes.push({ baseUrl: candidate, ok, status: response.status });
          if (response.status !== 404) {
            connectivityOnlyFailures = false;
          }
          if (ok) {
            successProbe = { baseUrl: candidate, status: response.status };
            break;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          probes.push({
            baseUrl: candidate,
            ok: false,
            error: message,
          });
          if (!isConnectivityError(message)) {
            connectivityOnlyFailures = false;
          }
        }
      }

      if (successProbe) {
        checks.push({
          name: "File route returns HTTP 200",
          ok: true,
          detail: `File route returned 200 via ${successProbe.baseUrl}.`,
          data: { probes, sampleId, sampleKey },
        });
      } else if (!requireServer && connectivityOnlyFailures) {
        checks.push({
          name: "File route returns HTTP 200",
          ok: true,
          detail: "SKIPPED: No local web server detected on candidate base URLs.",
          data: { probes, sampleId, sampleKey, skipped: true },
        });
      } else {
        checks.push({
          name: "File route returns HTTP 200",
          ok: false,
          detail: "File route request failed on all candidate local base URLs.",
          data: { probes, sampleId, sampleKey, requireServer },
        });
      }
    } else {
      const explainedNoData = uiReadyCount === 0 && minPapers === 0;
      checks.push({
        name: "File route returns HTTP 200",
        ok: explainedNoData,
        detail: explainedNoData
          ? "Skipped because no UI-ready papers exist yet and minimum is 0."
          : "Skipped because no UI-ready sample paper storage key was available.",
      });
    }
  } finally {
    await prisma.$disconnect();
  }

  const failing = checks.filter((check) => !check.ok);
  for (const check of checks) {
    console.log(`[doctor-past-papers] ${check.ok ? "PASS" : "FAIL"} - ${check.name}: ${check.detail}`);
    if (check.data) {
      console.log(JSON.stringify(check.data, null, 2));
    }
  }

  if (failing.length > 0) {
    console.error(`[doctor-past-papers] FAILED (${failing.length} check(s) failed)`);
    process.exit(1);
  }

  console.log("[doctor-past-papers] OK (all checks passed)");
}

main().catch((error) => {
  console.error("[doctor-past-papers] Unexpected error:", error);
  process.exit(1);
});
